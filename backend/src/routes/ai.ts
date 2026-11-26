import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { invokeAI } from "../lib/openai.js";
import { checkRateLimit } from "../lib/rateLimit.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import {
  effectivePlanCode,
  checkServerModuleAccess,
  getCurrentUsagePeriod,
  getServerPlan,
  isServerAdmin,
} from "../lib/planGovernance.js";

const safeFileUrlSchema = z.string().refine(
  (url) => url.startsWith("data:image/") || url.startsWith("https://") || url.startsWith("http://"),
  "URL de arquivo inválida para análise de IA.",
);

const aiSchema = z.object({
  prompt: z.string().min(1).max(40000),
  file_urls: z.array(safeFileUrlSchema).max(10).optional(),
  response_json_schema: z.record(z.string(), z.unknown()).optional(),
});

export const registerAiRoutes = async (app: FastifyInstance) => {
  app.post(
    "/api/ai/invoke",
    { preHandler: [app.authenticate] },
    async (request) => {
      const rate = checkRateLimit(`ai:${request.authUser.id}`, 30, 60 * 1000);
      if (!rate.allowed) {
        throw new AppError("Muitas solicitações de IA em sequência. Aguarde alguns segundos e tente novamente.", 429);
      }

      const payload = aiSchema.parse(request.body);

      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${request.authUser.id} FOR UPDATE`;
        const user = await tx.user.findUniqueOrThrow({
          where: { id: request.authUser.id },
        });
        if (isServerAdmin(user)) return;
        const access = checkServerModuleAccess(user, "scanner");
        if (!access.allowed) throw new AppError(access.message || "IA não incluída no plano.", 403);
        const permissions =
          (user.customPermissions as Record<string, any>) || {};
        const period = getCurrentUsagePeriod();
        const count =
          permissions.usagePeriod === period
            ? Number(permissions.monthlyAiScans || 0)
            : 0;
        if (count >= getServerPlan(effectivePlanCode(user)).aiScans) throw new AppError("Limite de IA do plano atingido. Consulte sua assinatura.", 403);
        await tx.user.update({
          where: { id: user.id },
          data: {
            customPermissions: {
              ...permissions,
              usagePeriod: period,
              monthlyAiScans: count + 1,
              monthlyExports:
                permissions.usagePeriod === period
                  ? Number(permissions.monthlyExports || 0)
                  : 0,
            },
          },
        });
      });

      return invokeAI(payload);
    },
  );
};
