import type { FastifyInstance } from "fastify";
import { isStripeConfigured } from "../lib/stripe.js";

export const registerHealthRoutes = async (app: FastifyInstance) => {
  const healthHandler = async () => ({
    ok: true,
    service: "nacif-electric-backend",
    stripeConfigured: isStripeConfigured,
    timestamp: new Date().toISOString(),
  });

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);
};
