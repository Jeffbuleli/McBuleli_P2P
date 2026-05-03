import { Prisma, StaffRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env, isAdminEmail } from "../config/env.js";

/** Table `UserStaffRole` absente — migrations Prisma non appliquées sur cette base. */
export function isStaffRolesTableMissing(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code !== "P2021") return false;
  const meta = e.meta as { table?: string } | undefined;
  if (meta?.table && /UserStaffRole/i.test(String(meta.table))) return true;
  return /UserStaffRole/i.test(e.message);
}

export async function hasStaffRole(userId: string, role: StaffRole): Promise<boolean> {
  try {
    const row = await prisma.userStaffRole.findUnique({
      where: { userId_role: { userId, role } },
    });
    return !!row;
  } catch (e) {
    if (isStaffRolesTableMissing(e)) return false;
    throw e;
  }
}

export async function getStaffRoles(userId: string): Promise<StaffRole[]> {
  try {
    const rows = await prisma.userStaffRole.findMany({
      where: { userId },
      select: { role: true },
    });
    return rows.map((r) => r.role);
  } catch (e) {
    if (isStaffRolesTableMissing(e)) {
      console.warn("[staff-role] Table UserStaffRole absente — exécutez : npx prisma migrate deploy");
      return [];
    }
    throw e;
  }
}

/** Admin panel + routes protégées : rôle ADMIN en base ou e-mail listé dans ADMIN_EMAILS (rétrocompat). */
export async function isPlatformAdmin(userId: string, email: string): Promise<boolean> {
  if (isAdminEmail(email)) return true;
  return hasStaffRole(userId, StaffRole.ADMIN);
}

/** Litiges / supervision : administrateur plateforme ou rôle AGENT. */
export async function isAgentOrAdmin(userId: string, email: string): Promise<boolean> {
  if (await isPlatformAdmin(userId, email)) return true;
  return hasStaffRole(userId, StaffRole.AGENT);
}

export async function resolveTreasuryUserIdInTx(tx: Prisma.TransactionClient): Promise<string | null> {
  try {
    const row = await tx.userStaffRole.findFirst({
      where: { role: StaffRole.TREASURY },
      select: { userId: true },
    });
    if (row) return row.userId;
  } catch (e) {
    if (isStaffRolesTableMissing(e)) {
      console.warn("[staking] Table UserStaffRole absente — fallback PLATFORM_STAKING_FEES_USER_ID uniquement.");
    } else throw e;
  }
  return env().PLATFORM_STAKING_FEES_USER_ID ?? null;
}

export async function listStaffRoleUsers(): Promise<
  Array<{ id: string; email: string; username: string; roles: StaffRole[] }>
> {
  try {
    const rows = await prisma.userStaffRole.findMany({
      include: {
        user: { select: { id: true, email: true, username: true } },
      },
      orderBy: [{ user: { email: "asc" } }, { role: "asc" }],
    });
    const byUser = new Map<
      string,
      { id: string; email: string; username: string; roles: StaffRole[] }
    >();
    for (const r of rows) {
      const u = r.user;
      const entry = byUser.get(u.id);
      if (entry) entry.roles.push(r.role);
      else byUser.set(u.id, { id: u.id, email: u.email, username: u.username, roles: [r.role] });
    }
    return Array.from(byUser.values());
  } catch (e) {
    if (isStaffRolesTableMissing(e)) return [];
    throw e;
  }
}

export async function assignStaffRole(
  targetUserId: string,
  role: StaffRole,
  actorUserId: string,
  actorEmail: string,
): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error("USER_NOT_FOUND");
  if (target.isBlacklisted) throw new Error("USER_BLACKLISTED");

  try {
    await prisma.$transaction(async (tx) => {
      if (role === StaffRole.TREASURY) {
        await tx.userStaffRole.deleteMany({ where: { role: StaffRole.TREASURY } });
      }
      await tx.userStaffRole.upsert({
        where: { userId_role: { userId: targetUserId, role } },
        create: {
          userId: targetUserId,
          role,
          assignedByUserId: actorUserId,
        },
        update: {
          assignedByUserId: actorUserId,
        },
      });
    });
  } catch (e) {
    if (isStaffRolesTableMissing(e)) throw new Error("STAFF_ROLES_SCHEMA_MISSING");
    throw e;
  }

  await prisma.adminAuditLog.create({
    data: {
      adminEmail: actorEmail,
      action: "STAFF_ROLE_ASSIGN",
      targetType: "UserStaffRole",
      targetId: `${targetUserId}:${role}`,
      metadata: { role, targetUserId },
    },
  });
}

export async function revokeStaffRole(
  targetUserId: string,
  role: StaffRole,
  actorUserId: string,
  actorEmail: string,
): Promise<void> {
  if (targetUserId === actorUserId && role === StaffRole.ADMIN) {
    throw new Error("CANNOT_REVOKE_OWN_ADMIN");
  }

  let result;
  try {
    result = await prisma.userStaffRole.deleteMany({
      where: { userId: targetUserId, role },
    });
  } catch (e) {
    if (isStaffRolesTableMissing(e)) throw new Error("STAFF_ROLES_SCHEMA_MISSING");
    throw e;
  }
  if (result.count === 0) throw new Error("ROLE_NOT_FOUND");

  await prisma.adminAuditLog.create({
    data: {
      adminEmail: actorEmail,
      action: "STAFF_ROLE_REVOKE",
      targetType: "UserStaffRole",
      targetId: `${targetUserId}:${role}`,
      metadata: { role, targetUserId },
    },
  });
}
