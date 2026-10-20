import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { brandingSchema, DEFAULT_BRANDING, normalizeBranding } from "../lib/branding.js";

const BRANDING_KEY = "branding";
const appSettings = (prisma as typeof prisma & { appSetting: any }).appSetting;

export const registerSettingsRoutes = async (app: FastifyInstance) => {
  app.get("/api/settings/branding", async () => {
    const setting = await appSettings.findUnique({
      where: { key: BRANDING_KEY },
    });

    return normalizeBranding(setting?.value ?? DEFAULT_BRANDING);
  });

  app.patch("/api/settings/branding", { preHandler: [app.requireAdmin] }, async (request) => {
    const data = normalizeBranding(brandingSchema.parse(request.body));

    const setting = await appSettings.upsert({
      where: { key: BRANDING_KEY },
      create: {
        key: BRANDING_KEY,
        value: data,
      },
      update: {
        value: data,
      },
    });

    return normalizeBranding(setting.value);
  });
};
