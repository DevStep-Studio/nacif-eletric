import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import staticPlugin from "@fastify/static";
import { env, uploadDirPath } from "./config/env.js";
import { authPlugin } from "./plugins/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerUploadRoutes } from "./routes/uploads.js";
import { registerAiRoutes } from "./routes/ai.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerAnalysisRoutes } from "./routes/analysis.js";
import { registerSubscriptionRoutes } from "./routes/subscriptions.js";
import { isAppError } from "./lib/errors.js";
import { ensureUploadDir } from "./lib/uploads.js";

export const buildApp = async () => {
  await ensureUploadDir();

  const allowedOrigins = new Set([
    env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://nacifenergy.com.br",
    "http://nacifenergy.com.br",
  ].filter(Boolean));

  const isAllowedOrigin = (origin?: string) => {
    if (!origin) {
      return true;
    }

    if (allowedOrigins.has(origin)) {
      return true;
    }

    try {
      const url = new URL(origin);
      const hostname = url.hostname;

      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return true;
      }

      if (
        hostname === "nacifenergy.com.br" ||
        hostname.endsWith(".nacifenergy.com.br") ||
        hostname.endsWith(".vercel.app") ||
        hostname.endsWith(".pages.dev")
      ) {
        return true;
      }

      if (hostname.startsWith("192.168.") || hostname.startsWith("10.") || hostname.startsWith("172.")) {
        return true;
      }
    } catch {
      return true;
    }

    return true;
  };

  const app = Fastify({
    logger: true,
    trustProxy: true, // Essencial para proxies reversos, Cloudflare e Nginx
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });

  // Preserva o rawBody (Buffer) para validação criptográfica de assinaturas de Webhook do Stripe
  app.addContentTypeParser(
    ["application/json", "application/json; charset=utf-8"],
    { parseAs: "buffer" },
    (req, body: Buffer, done) => {
      try {
        (req as any).rawBody = body;
        if (!body || body.length === 0) {
          done(null, {});
          return;
        }
        const json = JSON.parse(body.toString("utf-8"));
        done(null, json);
      } catch (err: any) {
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  await app.register(sensible);
  await app.register(cors, {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "stripe-signature",
      "x-requested-with",
      "Accept",
      "Origin",
    ],
    credentials: true,
    preflight: true,
    strictPreflight: false,
  });
  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });
  await app.register(multipart, {
    attachFieldsToBody: false,
    limits: {
      fileSize: 20 * 1024 * 1024,
    },
  });
  await app.register(staticPlugin, {
    root: uploadDirPath,
    prefix: "/uploads/",
  });
  await app.register(authPlugin);

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerUserRoutes(app);
  await registerProjectRoutes(app);
  await registerNotificationRoutes(app);
  await registerUploadRoutes(app);
  await registerAiRoutes(app);
  await registerAnalysisRoutes(app);
  await registerSettingsRoutes(app);
  await registerCatalogRoutes(app);
  await registerSubscriptionRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    const typedError = error as { issues?: Array<{ message?: string }> };

    if (isAppError(error)) {
      return reply.status(error.statusCode).send({ message: error.message });
    }

    if (Array.isArray(typedError.issues)) {
      return reply.status(400).send({ message: typedError.issues[0]?.message ?? "Dados inválidos." });
    }

    app.log.error(error);
    return reply.status(500).send({
      message: error instanceof Error ? error.message : "Erro interno do servidor.",
    });
  });

  return app;
};
