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

    const payload = await request.jwtVerify<{ sub: string; email: string; role: "admin" | "user" }>({
      onlyCookie: false,
    });

    request.authUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  });

  app.decorate("requireAdmin", async (request, reply) => {
    await app.authenticate(request, reply);

    if (request.authUser.role !== "admin") {
      return reply.forbidden("Acesso restrito a administradores.");
    }
  });
});
