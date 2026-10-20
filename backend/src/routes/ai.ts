import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { invokeAI } from "../lib/openai.js";

const aiSchema = z.object({
  prompt: z.string().min(1),
  file_urls: z.array(z.string()).optional(),
  response_json_schema: z.record(z.string(), z.unknown()).optional(),
});

export const registerAiRoutes = async (app: FastifyInstance) => {
  app.post("/api/ai/invoke", { preHandler: [app.authenticate] }, async (request) => {
    const payload = aiSchema.parse(request.body);
    return invokeAI(payload);
  });
};
