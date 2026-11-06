import { effectivePlanCode } from "../lib/planGovernance.js";
import { prisma } from "../lib/prisma.js";
import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

export const authPlugin = fp(async (app) => {
  app.decorate("authenticate", async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") || "";

    if (!token) {
      return reply.unauthorized("Faça login para continuar.");
    }

    const payload = await request.jwtVerify<{ sub: string; email: string; role: "admin" | "super_admin" | "user" }>({
      onlyCookie: false,
    });

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.isDeleted || user.status !== "active") return reply.unauthorized("Conta indisponível.");
    request.authUser = {
      id: payload.sub,
      email: payload.email,
      role: user.role,
      plan: effectivePlanCode(user),
      customPermissions: user.customPermissions,
    };
  });

  app.decorate("requireAdmin", async (request, reply) => {
    await app.authenticate(request, reply);

    if (reply.sent) return;
    if (request.authUser.role !== "admin" && request.authUser.role !== "super_admin") {
      return reply.forbidden("Acesso restrito a administradores.");
    }
  });
});
