import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import {
  createNotification,
  createNotificationsForUsers,
  serializeNotification,
} from "../lib/notifications.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const normalizeTone = (val: unknown) => {
  if (!val || typeof val !== "string") return undefined;
  const lower = val.toLowerCase().trim();
  if (lower === "error" || lower === "danger") return "warning";
  if (["info", "warning", "success"].includes(lower)) return lower;
  return "info";
};

const createNotificationSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório."),
  description: z.string().trim().min(1, "Descrição é obrigatória."),
  category: z.string().trim().optional(),
  tone: z.preprocess(normalizeTone, z.enum(["info", "warning", "success"]).optional()),
  href: z.string().trim().optional(),
  audience: z.enum(["self", "all", "user", "admin"]).optional(),
  user_id: z.string().trim().nullable().optional(),
}).passthrough();

export const registerNotificationRoutes = async (app: FastifyInstance) => {
  app.get("/api/notifications", { preHandler: [app.authenticate] }, async (request) => {
    const query = listQuerySchema.parse(request.query);

    const notifications = await prisma.notification.findMany({
      where: { userId: request.authUser.id },
      orderBy: { createdAt: "desc" },
      take: query.limit ?? 30,
    });

    return notifications.map(serializeNotification);
  });

  app.post("/api/notifications", { preHandler: [app.authenticate] }, async (request) => {
    const data = createNotificationSchema.parse(request.body);
    const audience = data.audience ?? (data.user_id && data.user_id !== request.authUser.id ? "user" : "self");

    if (audience === "all" || audience === "user") {
      if (request.authUser.role !== "admin" && (request.authUser.role as string) !== "super_admin") {
        throw new AppError("Apenas administradores podem enviar notificações para outros usuários.", 403);
      }
    }

    if (audience === "admin") {
      const admins = await prisma.user.findMany({
        where: {
          isDeleted: false,
          OR: [{ role: "admin" }, { role: "super_admin" }, { isSuperAdmin: true }],
        },
        select: { id: true },
      });
      if (admins.length > 0) {
        await createNotificationsForUsers(
          admins.map((adminUser) => adminUser.id),
          {
            title: data.title,
            description: data.description,
            category: data.category,
            tone: data.tone,
            href: data.href,
          },
        );
      }
      return { ok: true };
    }

    if (audience === "all") {
      const users = await prisma.user.findMany({ select: { id: true } });
      await createNotificationsForUsers(
        users.map((user) => user.id),
        data,
      );
      return { ok: true };
    }

    if (audience === "user") {
      if (!data.user_id) {
        throw new AppError("Informe o usuário de destino.", 400);
      }

      await createNotification({
        userId: data.user_id,
        title: data.title,
        description: data.description,
        category: data.category,
        tone: data.tone,
        href: data.href,
      });

      return { ok: true };
    }

    const notification = await createNotification({
      userId: request.authUser.id,
      title: data.title,
      description: data.description,
      category: data.category,
      tone: data.tone,
      href: data.href,
    });

    return serializeNotification(notification);
  });

  app.patch("/api/notifications/:id/read", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: request.authUser.id,
      },
    });

    if (!notification) {
      throw new AppError("Notificação não encontrada.", 404);
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return serializeNotification(updated);
  });

  app.post("/api/notifications/read-all", { preHandler: [app.authenticate] }, async (request) => {
    await prisma.notification.updateMany({
      where: {
        userId: request.authUser.id,
        read: false,
      },
      data: { read: true },
    });

    return { ok: true };
  });

  app.delete("/api/notifications", { preHandler: [app.authenticate] }, async (request) => {
    await prisma.notification.deleteMany({
      where: { userId: request.authUser.id },
    });

    return { ok: true };
  });
};
