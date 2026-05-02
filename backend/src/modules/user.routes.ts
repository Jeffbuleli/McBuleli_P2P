import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middlewares/authMiddleware.js";

const r = Router();

r.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const u = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      country: true,
      phone: true,
      kycStatus: true,
      profilePhotoUrl: true,
      p2pRatingAvg: true,
      completedTrades: true,
      createdAt: true,
      emailVerifiedAt: true,
      twoFactorEnabled: true,
    },
  });
  if (!u) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(u);
});

r.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().optional(),
    profilePhotoUrl: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const u = await prisma.user.update({
    where: { id: req.userId! },
    data: parsed.data,
  });
  return res.json({
    id: u.id,
    fullName: u.fullName,
    phone: u.phone,
    profilePhotoUrl: u.profilePhotoUrl,
  });
});

r.get("/:username/public", async (req, res) => {
  const username = req.params.username.toLowerCase();
  const u = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      p2pRatingAvg: true,
      completedTrades: true,
      createdAt: true,
      country: true,
    },
  });
  if (!u) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(u);
});

export default r;
