import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { generateResetToken, hashPassword, signAccessToken, verifyPassword } from "../lib/auth.js";
import { createNotificationsForUsers } from "../lib/notifications.js";
import { serializeUser } from "../lib/serializers.js";

const emailSchema = z.string().trim().toLowerCase().email("Informe um email válido.");
const passwordSchema = z.string().min(6, "A senha deve ter pelo menos 6 caracteres.");
const professionSchema = z.enum(["eletricista", "projetista", "arquiteto"]);

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  profession: professionSchema.optional(),
});

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
  plan: z.enum(["gratuito", "profissional", "engenharia"]).optional(),
}).strict();

const resetRequestSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(1).optional(),
  reset_token: z.string().min(1).optional(),
  newPassword: passwordSchema.optional(),
  new_password: passwordSchema.optional(),
});

export const registerAuthRoutes = async (app: FastifyInstance) => {
  app.post("/api/auth/register", async (request) => {
    const { email, password, profession } = registerSchema.parse(request.body);
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new AppError("Este email já está cadastrado.", 409);
    }

    const usersCount = await prisma.user.count();
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        fullName: email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        role: usersCount === 0 ? "admin" : "user",
        profession: profession ?? "projetista",
      },
    });

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
    const user = await prisma.user.update({
      where: { id: request.authUser.id },
      data: {
        fullName: data.full_name,
        profession,
        company: data.company,
        crea: data.crea,
        phone: data.phone,
        avatarUrl: data.avatar_url,
        plan: data.plan,
      },
    });

    return serializeUser(user);
  });

  app.post("/api/auth/reset-password-request", async (request) => {
    const { email } = resetRequestSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return { ok: true };
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
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      ok: true,
      recoveryLink: `${env.FRONTEND_URL}/reset-password?token=${token}`,
    };
  });

  app.post("/api/auth/reset-password", async (request) => {
    const parsed = resetPasswordSchema.parse(request.body);
    const token = parsed.resetToken ?? parsed.reset_token;
    const newPassword = parsed.newPassword ?? parsed.new_password;

    if (!token || !newPassword) {
      throw new AppError("Token e nova senha são obrigatórios.", 400);
    }

    const reset = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
      throw new AppError("Link de redefinição inválido ou expirado.", 400);
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash: await hashPassword(newPassword),
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true };
  });
};
