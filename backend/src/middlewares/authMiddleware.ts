import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  try {
    const token = h.slice(7);
    const p = verifyAccessToken(token);
    req.userId = p.sub;
    req.userEmail = p.email;
    next();
  } catch {
    res.status(401).json({ error: "INVALID_TOKEN" });
  }
}

export async function requireVerifiedEmail(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const u = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!u?.emailVerifiedAt) {
    res.status(403).json({ error: "EMAIL_NOT_VERIFIED" });
    return;
  }
  next();
}
