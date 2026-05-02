import { Router } from "express";
import { z } from "zod";
import { KycStatus } from "../constants/schemaEnums.js";
import { requireAuth, type AuthedRequest } from "../middlewares/authMiddleware.js";
import { requireAdmin } from "../middlewares/adminMiddleware.js";
import { prisma } from "../lib/prisma.js";
import {
  setKycStatus,
  freezeUser,
  resolveDispute,
  approveWithdrawal,
  rejectWithdrawal,
} from "../services/admin.service.js";
import { listSuspicious } from "../services/risk.service.js";
import { strictLimiter } from "../middlewares/rateLimit.js";

const r = Router();

r.use(requireAuth, requireAdmin);

r.get("/users", async (req, res) => {
  const q = (req.query.q as string) || "";
  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    take: 100,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      username: true,
      kycStatus: true,
      isFrozen: true,
      isBlacklisted: true,
      country: true,
      createdAt: true,
    },
  });
  return res.json(users);
});

r.post("/users/:id/kyc", strictLimiter, async (req: AuthedRequest, res) => {
  const schema = z.object({ status: z.nativeEnum(KycStatus) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await setKycStatus(req.params.id, parsed.data.status, req.userEmail!);
  return res.json({ ok: true });
});

r.post("/users/:id/freeze", strictLimiter, async (req: AuthedRequest, res) => {
  const schema = z.object({ frozen: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await freezeUser(req.params.id, req.userEmail!, parsed.data.frozen);
  return res.json({ ok: true });
});

r.get("/flags", async (_req, res) => {
  const flags = await listSuspicious();
  return res.json(flags);
});

r.get("/transactions", async (req, res) => {
  const items = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { email: true, username: true } } },
  });
  return res.json(items);
});

r.post("/disputes/:tradeId/resolve", strictLimiter, async (req: AuthedRequest, res) => {
  const schema = z.object({
    resolution: z.enum(["RESOLVED_BUYER", "RESOLVED_SELLER"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    await resolveDispute(req.params.tradeId, parsed.data.resolution as "RESOLVED_BUYER" | "RESOLVED_SELLER", req.userEmail!);
    return res.json({ ok: true });
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

r.post("/withdrawals/:id/approve", strictLimiter, async (req: AuthedRequest, res) => {
  try {
    await approveWithdrawal(req.params.id, req.userEmail!);
    return res.json({ ok: true });
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

r.post("/withdrawals/:id/reject", strictLimiter, async (req: AuthedRequest, res) => {
  try {
    await rejectWithdrawal(req.params.id, req.userEmail!);
    return res.json({ ok: true });
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

export default r;
