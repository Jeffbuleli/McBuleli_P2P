import type { Response, NextFunction } from "express";
import { isAdminEmail } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "./authMiddleware.js";

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId || !req.userEmail) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  if (!isAdminEmail(req.userEmail)) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  const u = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!u || u.isBlacklisted) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  next();
}
