import { prisma } from "../lib/prisma.js";

export async function flagSuspicious(userId: string, reason: string, metadata?: object) {
  return prisma.suspiciousFlag.create({
    data: {
      userId,
      reason,
      metadata: metadata ?? undefined,
    },
  });
}

export async function listSuspicious() {
  return prisma.suspiciousFlag.findMany({
    where: { resolved: false },
    include: { user: { select: { email: true, username: true, id: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
