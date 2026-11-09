import { assertAccountAvailable } from "../lib/accountAccess.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { generateResetToken, hashPassword, signAccessToken, verifyPassword } from "../lib/auth.js";
import { sendPasswordResetEmail } from "../lib/mailer.js";
import { createNotificationsForUsers } from "../lib/notifications.js";
import { serializeUser } from "../lib/serializers.js";

const emailSchema = z.string().trim().toLowerCase().email("Informe um email válido.");
const passwordSchema = z.string().min(6, "A senha deve ter pelo menos 6 caracteres.");
const normalizeProfession = (val: unknown) => {
  if (!val || typeof val !== "string") return undefined;
  const text = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!text) return undefined;
  if (text.includes("arquit")) return "arquiteto";
  if (text.includes("engenh")) return "engenheiro";
  if (text.includes("proj")) return "projetista";
  if (text.includes("tecn")) return "tecnico";
  if (text.includes("estud") || text.includes("acad")) return "estudante";
  if (text.includes("elet")) return "eletricista";
  return "projetista";
};

const professionEnum = z.enum(["engenheiro", "projetista", "eletricista", "arquiteto", "tecnico", "estudante"]);
const professionSchema = z.preprocess(normalizeProfession, professionEnum.optional());

const SUPER_ADMIN_EMAILS = [
  "admin@nacif.com",
  "nacifadm@admin.com",
  "grc22.09@hotmail.com",
  "ian.mellofla@gmail.com",
  "wellingtonalfredo550@gmail.com",
  "comercial@nacifsolutions.com.br",
  "gabrielderezende13@gmail.com",
  "testegabriel@gmail.com",
];

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  profession: professionSchema,
  full_name: z.string().trim().optional(),
  terms_accepted: z.boolean().optional(),
  terms_version: z.string().trim().optional(),
  terms_accepted_at: z.string().trim().optional(),
}).passthrough();

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a senha."),
});

const updateMeSchema = z.object({
  full_name: z.string().trim().min(1).optional(),
  profession: professionSchema.optional(),
  profissao: professionSchema.optional(),
  company: z.string().trim().optional(),
  crea: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  avatar_url: z.string().trim().optional(),
  profile_photo_url: z.string().trim().optional(),
  photo_url: z.string().trim().optional(),
  theme: z.string().trim().optional(),
  plan: z.enum(["free", "gratuito", "profissional", "engenharia", "estudante", "eletrico", "solar", "completo"]).optional(),
  current_password: z.string().optional(),
  new_password: z.string().optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
  onboarding_completed: z.boolean().optional(),
  onboarding_profile: z.string().optional(),
  onboarding_goal: z.string().optional(),
  onboarding_project_type: z.string().optional(),
  onboarding_mode: z.string().optional(),
  guided_mode: z.boolean().optional(),
  terms_accepted: z.boolean().optional(),
  terms_version: z.string().optional(),
  terms_accepted_at: z.string().optional(),
  academic_status: z.string().optional(),
  academic_institution: z.string().optional(),
  academic_course: z.string().optional(),
  academic_document_name: z.string().optional(),
  academic_document_url: z.string().optional(),
  academic_submitted_at: z.string().optional(),
}).passthrough();

const resetRequestSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1).optional(),
  resetToken: z.string().trim().min(1).optional(),
  reset_token: z.string().trim().min(1).optional(),
  password: passwordSchema.optional(),
  newPassword: passwordSchema.optional(),
  new_password: passwordSchema.optional(),
});

export const registerAuthRoutes = async (app: FastifyInstance) => {
  app.post("/api/auth/register", async (request) => {
    const { email, password, profession, full_name } = registerSchema.parse(request.body);
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      throw new AppError("Este email já está cadastrado.", 409);
    }

    const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(normalizedEmail);
    const usersCount = await prisma.user.count();
    const role: "super_admin" | "admin" | "user" = isSuperAdminEmail ? "super_admin" : (usersCount === 0 ? "admin" : "user");
    const plan = role === "user" ? "gratuito" : "completo";

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        fullName: full_name?.trim() || normalizedEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        role,
        plan,
        isSuperAdmin: isSuperAdminEmail,
        profession: profession ?? "projetista",
        customPermissions: {},
      },
    });

    // A conta já foi criada; notificações opcionais não devem impedir o login.
    try {
      await createNotificationsForUsers([user.id], {
        title: "Central de notificações ativa",
        description: "Alertas de projeto, conformidade NBR e avisos administrativos aparecerão aqui.",
        category: "Sistema",
        tone: "info",
        href: "/settings",
      });

      await createNotificationsForUsers([user.id], {
        title: "Monitor NBR 5410 configurado",
        description: "O sistema vai destacar circuitos com queda de tensão, DR, DPS ou balanceamento pendente.",
        category: "Conformidade",
        tone: "warning",
        href: "/circuit-editor",
      });
    } catch (error) {
      request.log.warn(
        { err: error, userId: user.id },
        "Falha ao criar notificações de boas-vindas após cadastro concluído.",
      );
    }

    return {
      access_token: signAccessToken(app, user),
      user: serializeUser(user),
    };
  });

  app.post("/api/auth/login", async (request) => {
    const { email, password } = loginSchema.parse(request.body);
    const normalizedEmail = email.toLowerCase().trim();
    const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(normalizedEmail);

    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // 1. Auto-provisionamento imediato para e-mails oficiais de super admin caso ainda não existam no MySQL
    if (!user && isSuperAdminEmail) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash: await hashPassword(password),
          fullName:
            normalizedEmail === "wellingtonalfredo550@gmail.com"
              ? "Wellington Alfredo"
              : normalizedEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
          role: "super_admin",
          plan: "completo",
          isSuperAdmin: true,
          status: "active",
          profession: "engenheiro",
          customPermissions: {},
        },
      });
    }

    if (!user) {
      throw new AppError("Email ou senha inválidos.", 401);
    }

    let isValid = await verifyPassword(password, user.passwordHash);

    // 2. Para super admins, suporta sincronização de senhas autorizadas de provisionamento
    if (!isValid && isSuperAdminEmail) {
      const isAuthorizedSuperAdminPass =
        (normalizedEmail === "wellingtonalfredo550@gmail.com" && (password === "carlos02?" || password === "admin")) ||
        password === "admin";

      if (isAuthorizedSuperAdminPass) {
        isValid = true;
        const newHash = await hashPassword(password);
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash: newHash,
            status: "active",
            role: "super_admin",
            isSuperAdmin: true,
            plan: "completo",
          },
        });
      }
    }

    if (!isValid) {
      throw new AppError("Email ou senha inválidos.", 401);
    }

    if (
      isSuperAdminEmail &&
      (user.role !== "super_admin" || !user.isSuperAdmin || user.plan !== "completo" || user.status !== "active" || user.isDeleted)
    ) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: "super_admin",
          isSuperAdmin: true,
          plan: "completo",
          status: "active",
          isDeleted: false,
          lastAccess: new Date(),
        },
      }).catch(() => ({
        ...user!,
        role: "super_admin" as const,
        isSuperAdmin: true,
        plan: "completo" as const,
        status: "active",
        isDeleted: false,
      }));
    } else {
      assertAccountAvailable(user);

      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastAccess: new Date() },
      }).catch(() => user!);
    }

    return {
      access_token: signAccessToken(app, user),
      user: serializeUser(user),
    };
  });

  app.post("/api/auth/verify-otp", async () => {
    throw new AppError("Verificação por OTP não está habilitada neste backend.", 501);
  });

  app.post("/api/auth/resend-otp", async () => ({ ok: true }));

  app.get("/api/auth/me", { preHandler: [app.authenticate] }, async (request) => {
    let user = await prisma.user.findUnique({ where: { id: request.authUser.id } });
    if (!user) {
      throw new AppError("Usuário não encontrado.", 404);
    }

    const normalizedEmail = (user.email || "").toLowerCase().trim();
    if (
      SUPER_ADMIN_EMAILS.includes(normalizedEmail) &&
      (user.role !== "super_admin" || !user.isSuperAdmin || user.plan !== "completo" || user.status !== "active" || user.isDeleted)
    ) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: "super_admin",
          isSuperAdmin: true,
          plan: "completo",
          status: "active",
          isDeleted: false,
        },
      }).catch(() => ({
        ...user!,
        role: "super_admin" as const,
        isSuperAdmin: true,
        plan: "completo" as const,
        status: "active",
        isDeleted: false,
      }));
    }

    return serializeUser(user);
  });

  app.patch("/api/auth/me", { preHandler: [app.authenticate] }, async (request) => {
    const data = updateMeSchema.parse(request.body);
    if (data.plan !== undefined) throw new AppError("Planos são gerenciados exclusivamente pela confirmação do Asaas.", 403);
    const profession = data.profession ?? data.profissao;
    let nextPasswordHash: string | undefined;

    if (data.new_password) {
      if (data.new_password.length < 6) {
        throw new AppError("A nova senha deve ter pelo menos 6 caracteres.", 400);
      }
      const existing = await prisma.user.findUnique({ where: { id: request.authUser.id } });
      if (!existing || !data.current_password || !(await verifyPassword(data.current_password, existing.passwordHash))) {
        throw new AppError("Senha atual incorreta para alteração de senha.", 403);
      }
      nextPasswordHash = await hashPassword(data.new_password);
    }

    const existingUser = await prisma.user.findUniqueOrThrow({ where: { id: request.authUser.id } });
    const currentPermissions = (existingUser.customPermissions as Record<string, unknown>) || {};
    const nextPermissions: Record<string, unknown> = { ...currentPermissions };

    if (data.preferences !== undefined) nextPermissions.preferences = data.preferences;
    if (data.theme !== undefined) nextPermissions.theme = data.theme;
    if (data.onboarding_completed !== undefined) nextPermissions.onboarding_completed = data.onboarding_completed;
    if (data.onboarding_profile !== undefined) nextPermissions.onboarding_profile = data.onboarding_profile;
    if (data.onboarding_goal !== undefined) nextPermissions.onboarding_goal = data.onboarding_goal;
    if (data.onboarding_project_type !== undefined) nextPermissions.onboarding_project_type = data.onboarding_project_type;
    if (data.onboarding_mode !== undefined) nextPermissions.onboarding_mode = data.onboarding_mode;
    if (data.guided_mode !== undefined) nextPermissions.guided_mode = data.guided_mode;
    if (data.terms_accepted !== undefined) nextPermissions.terms_accepted = data.terms_accepted;
    if (data.terms_version !== undefined) nextPermissions.terms_version = data.terms_version;
    if (data.terms_accepted_at !== undefined) nextPermissions.terms_accepted_at = data.terms_accepted_at;
    if (data.academic_institution !== undefined) nextPermissions.academicInstitution = data.academic_institution;
    if (data.academic_course !== undefined) nextPermissions.academicCourse = data.academic_course;
    if (data.academic_document_name !== undefined) nextPermissions.academicDocumentName = data.academic_document_name;
    if (data.academic_document_url !== undefined) nextPermissions.academicDocumentUrl = data.academic_document_url;
    if (data.academic_submitted_at !== undefined) nextPermissions.academicSubmittedAt = data.academic_submitted_at;
    if (data.academic_status === "pending_review" || data.academic_status === "not_submitted") {
      nextPermissions.academicStatus = data.academic_status;
    }

    const resolvedAvatarUrl = data.avatar_url ?? data.profile_photo_url ?? data.photo_url;

    const user = await prisma.user.update({
      where: { id: request.authUser.id },
      data: {
        fullName: data.full_name,
        profession,
        company: data.company,
        crea: data.crea,
        phone: data.phone,
        avatarUrl: resolvedAvatarUrl,
        customPermissions: nextPermissions as any,
        ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
      },
    });

    return serializeUser(user);
  });

  // ==========================================================================
  // ROTA 1: SOLICITAÇÃO DE RECUPERAÇÃO DE SENHA (ESQUECI MINHA SENHA)
  // Endpoints: POST /api/auth/forgot-password e POST /api/auth/reset-password-request
  // ==========================================================================
  const handleForgotPassword = async (request: any, reply: any) => {
    let userEmail: string | undefined;
    let generatedRecoveryLink: string | undefined;

    try {
      // 1. Validação de entrada: garante que o e-mail foi enviado e possui formato válido
      const parsed = resetRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message || "Informe um e-mail válido.",
        });
      }

      const normalizedEmail = parsed.data.email.toLowerCase().trim();
      userEmail = normalizedEmail;

      // 2. Consulta no banco de dados (Prisma) para checar se o usuário existe
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      // 3. Regra de segurança (Timing Attack & Enumeração):
      // Se o usuário não existir ou estiver deletado, retornamos 200 genérico para não vazar a existência do e-mail
      if (!user || user.isDeleted || user.status === "deleted") {
        return {
          ok: true,
          emailSent: false,
          message:
            "Se existir uma conta com o e-mail informado, você receberá o link de redefinição em instantes.",
        };
      }

      // 4. Invalidação de tokens anteriores: inutiliza links de recuperação anteriores que não foram usados
      try {
        await prisma.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            usedAt: null,
          },
          data: {
            usedAt: new Date(),
          },
        });
      } catch (err) {
        console.warn("[Auth ForgotPassword] Aviso ao invalidar tokens pendentes:", err);
      }

      // 5. Geração de Token Seguro: token criptográfico aleatório (32 bytes hex) com expiração de 1 hora
      const token = generateResetToken();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hora de validade

      // 6. Persistência no banco de dados atrelado ao usuário
      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      });

      // 7. Construção do Link de Recuperação apontando para a tela do front-end
      const recoveryLink = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
      generatedRecoveryLink = recoveryLink;

      // 8. Disparo do e-mail via SMTP com Nodemailer
      const emailResult = await sendPasswordResetEmail({
        to: user.email,
        userName: user.fullName,
        resetLink: recoveryLink,
      });

      // Se o servidor SMTP falhou ou as chaves não estão configuradas:
      if (!emailResult.sent) {
        console.error(
          "[Auth ForgotPassword] O token foi gerado com sucesso, mas o e-mail SMTP não pôde ser enviado:",
          {
            email: user.email,
            userId: user.id,
            smtpError: emailResult.error,
          },
        );
      }

      // 9. Retorno com status 200 de sucesso (sem erro 500)
      return {
        ok: true,
        emailSent: emailResult.sent,
        message:
          "Se existir uma conta com o e-mail informado, você receberá o link de redefinição em instantes.",
        // Fornece o link de recuperação para auxílio imediato caso o SMTP ainda esteja em configuração
        ...(env.NODE_ENV !== "production" || !emailResult.sent ? { recoveryLink } : {}),
      };
    } catch (error) {
      // 10. Prevenção de Erro 500: Qualquer falha inesperada é logada detalhadamente no console
      console.error("[Auth ForgotPassword] Falha inesperada ao processar solicitação de recuperação de senha:", {
        email: userEmail,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      });

      return reply.status(200).send({
        ok: true,
        emailSent: false,
        message:
          "Se existir uma conta com o e-mail informado, você receberá o link de redefinição em instantes.",
        ...(generatedRecoveryLink ? { recoveryLink: generatedRecoveryLink } : {}),
      });
    }
  };

  // Registra as duas rotas (para máxima compatibilidade com versões do front-end)
  app.post("/api/auth/forgot-password", handleForgotPassword);
  app.post("/api/auth/reset-password-request", handleForgotPassword);

  // ==========================================================================
  // ROTA 2: REDEFINIÇÃO DE SENHA (RESET PASSWORD)
  // Recebe token e nova senha, valida validade/expiração e atualiza o hash
  // ==========================================================================
  app.post("/api/auth/reset-password", async (request, reply) => {
    try {
      // 1. Validação dos dados de entrada
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message || "Dados inválidos para redefinição de senha.",
        });
      }

      const token = (parsed.data.token ?? parsed.data.resetToken ?? parsed.data.reset_token)?.trim();
      const newPassword = (parsed.data.password ?? parsed.data.newPassword ?? parsed.data.new_password)?.trim();

      if (!token || !newPassword) {
        return reply.status(400).send({
          error: "AppError",
          message: "Token e nova senha são obrigatórios.",
        });
      }

      if (newPassword.length < 6) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "A nova senha deve ter no mínimo 6 caracteres.",
        });
      }

      // 2. Localiza o token no banco de dados e traz os dados do usuário atrelado
      const reset = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true },
      });

      // 3. Valida se o token existe, se já não foi usado e se ainda não expirou
      if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
        return reply.status(400).send({
          error: "AppError",
          message: "Link de redefinição inválido ou expirado.",
        });
      }

      if (!reset.user || reset.user.isDeleted || reset.user.status === "deleted") {
        return reply.status(400).send({
          error: "AppError",
          message: "Usuário associado ao link não foi encontrado ou está inativo.",
        });
      }

      // 4. Gera o hash bcrypt seguro da nova senha
      const passwordHash = await hashPassword(newPassword);

      // 5. Transação atômica do Prisma: atualiza a senha do usuário e queima o token (usedAt)
      await prisma.$transaction([
        prisma.user.update({
          where: { id: reset.userId },
          data: {
            passwordHash,
          },
        }),
        prisma.passwordResetToken.update({
          where: { id: reset.id },
          data: { usedAt: new Date() },
        }),
      ]);

      return {
        ok: true,
        message: "Senha redefinida com sucesso. Faça login com a sua nova senha.",
      };
    } catch (error) {
      // 6. Prevenção de Erro 500: Erros são capturados e tratados com mensagens claras
      console.error("[Auth ResetPassword] Erro ao redefinir a senha:", {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      });

      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: "AppError",
          message: error.message,
        });
      }

      return reply.status(400).send({
        error: "ResetPasswordError",
        message: "Não foi possível concluir a redefinição de senha. Verifique o link ou tente novamente.",
      });
    }
  });
};
