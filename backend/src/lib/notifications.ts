import { prisma } from "./prisma.js";

type NotificationInput = {
  userId: string;
  title: string;
  description: string;
  category?: string;
  tone?: string;
  href?: string;
  read?: boolean;
  metadata?: unknown;
};

export const createNotification = async ({
  userId,
  title,
  description,
  category = "Sistema",
  tone = "info",
  href = "/",
  read = false,
  metadata,
}: NotificationInput) =>
  prisma.notification.create({
    data: {
      userId,
      title,
      description,
      category,
      tone,
      href,
      read,
      metadata: metadata as object | undefined,
    },
  });

export const createNotificationsForUsers = async (
  userIds: string[],
  payload: Omit<NotificationInput, "userId">,
) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  if (uniqueUserIds.length === 0) return { count: 0 };

  return prisma.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      userId,
      title: payload.title,
      description: payload.description,
      category: payload.category ?? "Sistema",
      tone: payload.tone ?? "info",
      href: payload.href ?? "/",
      read: payload.read ?? false,
      metadata: payload.metadata as object | undefined,
    })),
  });
};

export const serializeNotification = (notification: {
  id: string;
  title: string;
  description: string;
  category: string;
  tone: string;
  href: string;
  read: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: notification.id,
  title: notification.title,
  description: notification.description,
  category: notification.category,
  tone: notification.tone,
  href: notification.href,
  read: notification.read,
  metadata: notification.metadata,
  created_date: notification.createdAt.toISOString(),
  updated_date: notification.updatedAt.toISOString(),
});
