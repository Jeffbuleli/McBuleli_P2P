import type { Prisma, UserNotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function createNotification(
  userId: string,
  type: UserNotificationType,
  title: string,
  body: string,
  metadata?: Prisma.InputJsonValue,
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      metadata: metadata ?? undefined,
    },
  });
}

export async function createNotifications(
  items: Array<{
    userId: string;
    type: UserNotificationType;
    title: string;
    body: string;
    metadata?: Prisma.InputJsonValue;
  }>,
) {
  if (!items.length) return { count: 0 };
  return prisma.notification.createMany({
    data: items.map((i) => ({
      userId: i.userId,
      type: i.type,
      title: i.title,
      body: i.body,
      metadata: i.metadata ?? undefined,
    })),
  });
}

export async function listNotificationsForUser(userId: string, take = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function markNotificationRead(userId: string, id: string) {
  const n = await prisma.notification.findFirst({
    where: { id, userId },
  });
  if (!n) return null;
  return prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
