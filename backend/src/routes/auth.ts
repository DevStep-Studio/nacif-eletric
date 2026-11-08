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
  "grc22.09@hotmail.com",
  "ian.mellofla@gmail.com",
  "wellingtonalfredo550@gmail.com",
  "comercial@nacifsolutions.com.br",
  "gabrielderezende13@gmail.com",
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
    const plan: "completo" | "gratuito" = isSuperAdminEmail ? "completo" : "gratuito";

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
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError("Email ou senha inválidos.", 401);
    }

    assertAccountAvailable(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastAccess: new Date() },
    }).catch(() => {});

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
    const user = await prisma.user.findUnique({ where: { id: request.authUser.id } });
    if (!user) {
      throw new AppError("Usuário não encontrado.", 404);
    }
    return serializeUser(user);
  });

  app.patch("/api/auth/me", { preHandler: [app.authenticate] }, async (request) => {
    const data = updateMeSchema.parse(request.body);
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

    if (data.plan) throw new AppError("Planos são gerenciados pela assinatura Stripe.", 403);

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

  const handleForgotPassword = async (request: any, reply: any) => {
    try {
      const parsed = resetRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message || "Informe um e-mail válido.",
        });
      }

      const normalizedEmail = parsed.data.email.toLowerCase().trim();
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user || user.isDeleted || user.status === "deleted") {
        return {
          ok: true,
          emailSent: false,
          message:
            "Se existir uma conta com o e-mail informado, você receberá o link de redefinição em instantes.",
        };
      }

      await prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      const token = generateResetToken();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // Validade de 1 hora

      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt,
        },
      });

      const recoveryLink = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
      const emailResult = await sendPasswordResetEmail({
        to: user.email,
        userName: user.fullName,
        resetLink: recoveryLink,
      });

      if (!emailResult.sent) {
        console.error(
          "[Auth ForgotPassword] E-mail de redefinição não pôde ser enviado via SMTP; token gerado com sucesso no banco:",
          {
            email: user.email,
            userId: user.id,
            smtpError: emailResult.error,
          },
        );
      }

      return {
        ok: true,
        emailSent: emailResult.sent,
        message:
          "Se existir uma conta com o e-mail informado, você receberá o link de redefinição em instantes.",
        ...(env.NODE_ENV !== "production" || !emailResult.sent ? { recoveryLink } : {}),
      };
    } catch (error) {
      console.error("[Auth ForgotPassword] Falha inesperada ao processar solicitação de recuperação de senha:", error);
      return reply.status(200).send({
        ok: true,
        emailSent: false,
        message:
          "Não foi possível disparar o e-mail no momento, mas sua solicitação foi registrada. Verifique a configuração SMTP ou tente novamente em instantes.",
      });
    }
  };

  app.post("/api/auth/forgot-password", handleForgotPassword);
  app.post("/api/auth/reset-password-request", handleForgotPassword);

  app.post("/api/auth/reset-password", async (request, reply) => {
    try {
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: parsed.error.issues[0]?.message || "Dados inválidos para redefinição de senha.",
        });
      }

      const token = parsed.data.token ?? parsed.data.resetToken ?? parsed.data.reset_token;
      const newPassword = parsed.data.password ?? parsed.data.newPassword ?? parsed.data.new_password;

      if (!token || !newPassword) {
        return reply.status(400).send({
          error: "AppError",
          message: "Token e nova senha são obrigatórios.",
        });
      }

      const reset = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
        return reply.status(400).send({
          error: "AppError",
          message: "Link de redefinição inválido ou expirado.",
        });
      }

      const passwordHash = await hashPassword(newPassword);

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
        message: "Senha redefinida com sucesso.",
      };
    } catch (error) {
      console.error("[Auth ResetPassword] Erro ao redefinir a senha:", error);
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: "AppError",
          message: error.message,
        });
      }
      return reply.status(400).send({
        error: "ResetPasswordError",
        message: "Não foi possível concluir a redefinição de senha. Tente novamente.",
      });
    }
  });
};
