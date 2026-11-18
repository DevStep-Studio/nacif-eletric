import type { FastifyInstance } from "fastify";
import { BILLING_API_VERSION } from "../lib/planCatalog.js";
import { asaasConfigured } from "../lib/asaas.js";

export const registerHealthRoutes = async (app: FastifyInstance) => {
  const healthHandler = async () => ({
    ok: true,
    service: "nacif-electric-backend",
    billingApiVersion: BILLING_API_VERSION,
    asaasConfigured: asaasConfigured(),
    timestamp: new Date().toISOString(),
  });

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);
};
