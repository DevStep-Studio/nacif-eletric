import { assertAccountAvailable } from "../lib/accountAccess.js";
import { effectivePlanCode } from "../lib/planGovernance.js";
import { SUPER_ADMIN_EMAILS } from "../lib/serializers.js";
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
    assertAccountAvailable(user);
    const normalizedEmail = (user.email || payload.email || "").toLowerCase().trim();
    const isSuper =
      user.role === "super_admin" ||
      Boolean(user.isSuperAdmin) ||
      SUPER_ADMIN_EMAILS.includes(normalizedEmail);

    request.authUser = {
      id: payload.sub,
      email: payload.email,
      role: isSuper ? "super_admin" : user.role,
      plan: isSuper ? "completo" : effectivePlanCode(user),
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
