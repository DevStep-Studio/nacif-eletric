import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { serializeUser } from "../lib/serializers.js";

const updateUserSchema = z.object({
  full_name: z.string().trim().min(1).optional(),
  role: z.enum(["admin", "user"]).optional(),
  plan: z.enum(["gratuito", "profissional", "engenharia", "estudante", "eletrico", "solar", "completo"]).optional(),
  profession: z.enum(["eletricista", "projetista", "arquiteto"]).optional(),
  profissao: z.enum(["eletricista", "projetista", "arquiteto"]).optional(),
  company: z.string().trim().optional(),
  crea: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  avatar_url: z.string().trim().optional(),
}).strict();

export const registerUserRoutes = async (app: FastifyInstance) => {
  app.get("/api/users", { preHandler: [app.requireAdmin] }, async () => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });

    return users.map(serializeUser);
  });

  app.patch("/api/users/:id", { preHandler: [app.requireAdmin] }, async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const data = updateUserSchema.parse(request.body);
    const profession = data.profession ?? data.profissao;

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        fullName: data.full_name,
        role: data.role,
        plan: data.plan,
        profession,
        company: data.company,
        crea: data.crea,
        phone: data.phone,
        avatarUrl: data.avatar_url,
      },
    });

    return serializeUser(user);
  });
};
