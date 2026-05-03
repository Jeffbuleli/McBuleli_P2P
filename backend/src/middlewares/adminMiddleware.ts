import type { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { isAgentOrAdmin, isPlatformAdmin } from "../services/staff-role.service.js";
import type { AuthedRequest } from "./authMiddleware.js";

async function ensureStaffUser(req: AuthedRequest, res: Response): Promise<boolean> {
  if (!req.userId || !req.userEmail) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return false;
  }
  const u = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!u || u.isBlacklisted) {
    res.status(403).json({ error: "FORBIDDEN" });
    return false;
  }
  return true;
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!(await ensureStaffUser(req, res))) return;
  const allowed = await isPlatformAdmin(req.userId!, req.userEmail!);
  if (!allowed) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  next();
}

/** Administrateur ou agent (support / litiges / supervision transactions). */
export async function requireAgentOrAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!(await ensureStaffUser(req, res))) return;
  const allowed = await isAgentOrAdmin(req.userId!, req.userEmail!);
  if (!allowed) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  next();
}
