import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { invokeAI } from "../lib/openai.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { getCurrentUsagePeriod, getServerPlan, isServerAdmin } from "../lib/planGovernance.js";

const aiSchema = z.object({
  prompt: z.string().min(1),
  file_urls: z.array(z.string()).optional(),
  response_json_schema: z.record(z.string(), z.unknown()).optional(),
});

export const registerAiRoutes = async (app: FastifyInstance) => {
  app.post("/api/ai/invoke", { preHandler: [app.authenticate] }, async (request) => {
    const payload = aiSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: request.authUser.id } });
    if (!user) throw new AppError("Usuário não encontrado.", 404);

    if (!isServerAdmin(user)) {
      const permissions = (user.customPermissions as Record<string, unknown>) || {};
      const currentPeriod = getCurrentUsagePeriod();
      const userPeriod = String(permissions.usagePeriod || currentPeriod);
      const currentAiScans = userPeriod === currentPeriod ? Number(permissions.monthlyAiScans || 0) : 0;
      const plan = getServerPlan(user.plan);

      if (plan.aiScans !== Number.POSITIVE_INFINITY && currentAiScans >= plan.aiScans) {
        throw new AppError(
          `Limite mensal de ${plan.aiScans} operações de IA atingido para o plano ${plan.name}. Faça upgrade para continuar utilizando IA.`,
          403,
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          customPermissions: {
            ...permissions,
            usagePeriod: currentPeriod,
            monthlyAiScans: currentAiScans + 1,
          },
        },
      });
    }

    return invokeAI(payload);
  });
};
