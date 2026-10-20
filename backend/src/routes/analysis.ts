import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildAiRequestedPlan, buildProfessionalPlanAnalysis, estimateSolarRoof } from "../lib/analysis.js";

const pointSchema = z.record(z.string(), z.unknown());
const roomSchema = z.record(z.string(), z.unknown());

const requestedPlanSchema = z.object({
  requestText: z.string().min(1),
  infraType: z.string().optional(),
});

const professionalPlanSchema = z.object({
  points: z.array(pointSchema).optional(),
  rooms: z.array(roomSchema).optional(),
  includeSuggestedPoints: z.boolean().optional(),
  infraType: z.string().optional(),
});

const roofEstimateSchema = z.object({
  project: z.record(z.string(), z.unknown()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const registerAnalysisRoutes = async (app: FastifyInstance) => {
  app.post("/api/analysis/planta/requested-plan", { preHandler: [app.authenticate] }, async (request) => {
    const payload = requestedPlanSchema.parse(request.body);
    return buildAiRequestedPlan(payload.requestText, payload.infraType || "embutido");
  });

  app.post("/api/analysis/planta/professional-plan", { preHandler: [app.authenticate] }, async (request) => {
    const payload = professionalPlanSchema.parse(request.body);
    return buildProfessionalPlanAnalysis({
      points: payload.points || [],
      rooms: payload.rooms || [],
      includeSuggestedPoints: payload.includeSuggestedPoints ?? true,
      infraType: payload.infraType || "embutido",
    });
  });

  app.post("/api/analysis/solar/roof-estimate", { preHandler: [app.authenticate] }, async (request) => {
    const payload = roofEstimateSchema.parse(request.body);
    return estimateSolarRoof(payload.project || {}, payload.config || {});
  });
};
