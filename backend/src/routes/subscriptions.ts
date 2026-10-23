import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { serializeUser } from "../lib/serializers.js";

const changePlanSchema = z.object({
  planCode: z.enum(["gratuito", "profissional", "engenharia", "estudante", "eletrico", "solar", "completo"]),
  cycle: z.enum(["monthly", "annual"]).default("monthly"),
});

const academicVerifySchema = z.object({
  institution: z.string().trim().min(2, "Instituição de ensino é obrigatória."),
  course: z.string().trim().min(2, "Curso é obrigatório."),
  documentName: z.string().trim().optional(),
  documentUrl: z.string().trim().optional(),
});

const cancelSubscriptionSchema = z.object({
  reason: z.string().trim().optional(),
});

const adminUpdatePlanSchema = z.object({
  plan: z.enum(["gratuito", "profissional", "engenharia", "estudante", "eletrico", "solar", "completo"]),
  cycle: z.enum(["monthly", "annual"]).optional(),
  status: z.string().optional(),
});

const adminDecideAcademicSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

export const registerSubscriptionRoutes = async (app: FastifyInstance) => {
  // 1. Obter status da assinatura do usuário atual
  app.get("/api/subscriptions/status", { preHandler: [app.authenticate] }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.authUser.id },
    });

    if (!user) {
      throw new AppError("Usuário não encontrado.", 404);
    }

    return {
      plan: user.plan,
      status: "active",
      validUntil: null,
      academicStatus: "approved",
    };
  });

  // 2. Mudar de plano (Upgrade / Downgrade)
  app.post("/api/subscriptions/change-plan", { preHandler: [app.authenticate] }, async (request) => {
    const { planCode } = changePlanSchema.parse(request.body);

    const user = await prisma.user.update({
      where: { id: request.authUser.id },
      data: {
        plan: planCode,
      },
    });

    return serializeUser(user);
  });

  // 3. Cancelar assinatura
  app.post("/api/subscriptions/cancel", { preHandler: [app.authenticate] }, async (request) => {
    cancelSubscriptionSchema.parse(request.body);

    const user = await prisma.user.update({
      where: { id: request.authUser.id },
      data: {
        plan: "gratuito",
      },
    });

    return serializeUser(user);
  });

  // 4. Enviar comprovação de matrícula estudantil
  app.post("/api/subscriptions/academic-verify", { preHandler: [app.authenticate] }, async (request) => {
    academicVerifySchema.parse(request.body);

    return {
      message: "Comprovante enviado com sucesso para análise administrativa.",
      status: "pending_review",
    };
  });

  // 5. Admin: Listar todos os usuários com dados de assinatura
  app.get("/api/subscriptions/admin/users", { preHandler: [app.requireAdmin] }, async () => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });

    return users.map(serializeUser);
  });

  // 6. Admin: Atualizar plano de qualquer usuário
  app.patch("/api/subscriptions/admin/users/:id/plan", { preHandler: [app.requireAdmin] }, async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const data = adminUpdatePlanSchema.parse(request.body);

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        plan: data.plan,
      },
    });

    return serializeUser(user);
  });

  // 7. Admin: Decidir aprovação ou rejeição de estudante
  app.post("/api/subscriptions/admin/academic/:id/decide", { preHandler: [app.requireAdmin] }, async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const data = adminDecideAcademicSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) throw new AppError("Usuário não encontrado.", 404);

    return {
      id: user.id,
      academicStatus: data.decision === "approve" ? "approved" : "rejected",
    };
  });
};
