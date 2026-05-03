import { Router } from "express";
import { z } from "zod";
import { KycStatus } from "../constants/schemaEnums.js";
import { requireAuth, type AuthedRequest } from "../middlewares/authMiddleware.js";
import { requireAdmin, requireAgentOrAdmin } from "../middlewares/adminMiddleware.js";
import { prisma } from "../lib/prisma.js";
import {
  setKycStatus,
  freezeUser,
  resolveDispute,
  approveWithdrawal,
  rejectWithdrawal,
  listOpenDisputesForStaff,
} from "../services/admin.service.js";
import {
  createStakingPool,
  deleteStakingPool,
  exportStakingTransactionsCsv,
  exportUserStakesCsv,
  listStakingPoolsAdmin,
  updateStakingPool,
} from "../services/admin-staking.service.js";
import {
  assignStaffRole,
  listStaffRoleUsers,
  revokeStaffRole,
} from "../services/staff-role.service.js";
import { StaffRole } from "@prisma/client";
import { listSuspicious } from "../services/risk.service.js";
import { strictLimiter } from "../middlewares/rateLimit.js";
import { queryString, routeParam } from "../lib/expressParams.js";

const r = Router();

r.use(requireAuth);

r.get("/users", requireAgentOrAdmin, async (req, res) => {
  const q = queryString(req.query.q) || "";
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

r.post("/users/:id/kyc", strictLimiter, requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({ status: z.nativeEnum(KycStatus) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await setKycStatus(routeParam(req.params.id), parsed.data.status, req.userEmail!);
  return res.json({ ok: true });
});

r.post("/users/:id/freeze", strictLimiter, requireAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({ frozen: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await freezeUser(routeParam(req.params.id), req.userEmail!, parsed.data.frozen);
  return res.json({ ok: true });
});

r.get("/flags", requireAgentOrAdmin, async (_req, res) => {
  const flags = await listSuspicious();
  return res.json(flags);
});

r.get("/transactions", requireAgentOrAdmin, async (req, res) => {
  const items = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { email: true, username: true } } },
  });
  return res.json(items);
});

r.get("/disputes", requireAgentOrAdmin, async (_req, res) => {
  const rows = await listOpenDisputesForStaff();
  return res.json(rows);
});

r.post("/disputes/:tradeId/resolve", strictLimiter, requireAgentOrAdmin, async (req: AuthedRequest, res) => {
  const schema = z.object({
    resolution: z.enum(["RESOLVED_BUYER", "RESOLVED_SELLER"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    await resolveDispute(routeParam(req.params.tradeId), parsed.data.resolution as "RESOLVED_BUYER" | "RESOLVED_SELLER", req.userEmail!);
    return res.json({ ok: true });
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

r.post("/withdrawals/:id/approve", strictLimiter, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await approveWithdrawal(routeParam(req.params.id), req.userEmail!);
    return res.json({ ok: true });
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

r.post("/withdrawals/:id/reject", strictLimiter, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await rejectWithdrawal(routeParam(req.params.id), req.userEmail!);
    return res.json({ ok: true });
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

const staffRoleBody = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(StaffRole),
});

r.get("/staff-roles", requireAdmin, async (_req, res) => {
  const users = await listStaffRoleUsers();
  return res.json({ users });
});

r.post("/staff-roles", strictLimiter, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = staffRoleBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    await assignStaffRole(parsed.data.userId, parsed.data.role, req.userId!, req.userEmail!);
    return res.status(201).json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "USER_NOT_FOUND") return res.status(404).json({ error: msg });
    if (msg === "USER_BLACKLISTED") return res.status(400).json({ error: msg });
    if (msg === "STAFF_ROLES_SCHEMA_MISSING") {
      return res.status(503).json({ error: "STAFF_ROLES_SCHEMA_MISSING" });
    }
    throw e;
  }
});

r.delete("/staff-roles/:userId/:role", strictLimiter, requireAdmin, async (req: AuthedRequest, res) => {
  const userId = routeParam(req.params.userId);
  const roleParsed = z.nativeEnum(StaffRole).safeParse(routeParam(req.params.role));
  if (!roleParsed.success) return res.status(400).json({ error: "INVALID_ROLE" });
  try {
    await revokeStaffRole(userId, roleParsed.data, req.userId!, req.userEmail!);
    return res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "ROLE_NOT_FOUND") return res.status(404).json({ error: msg });
    if (msg === "CANNOT_REVOKE_OWN_ADMIN") return res.status(400).json({ error: msg });
    if (msg === "STAFF_ROLES_SCHEMA_MISSING") {
      return res.status(503).json({ error: "STAFF_ROLES_SCHEMA_MISSING" });
    }
    throw e;
  }
});

const stakingPoolCreate = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  asset: z.enum(["USDT", "BTC"]).default("USDT"),
  nameFr: z.string().optional().nullable(),
  nameEn: z.string().optional().nullable(),
  apyAnnual: z.string().regex(/^\d+(\.\d+)?$/),
  lockDays: z.coerce.number().int().min(1).max(3650),
  minAmount: z.string().regex(/^\d+(\.\d+)?$/),
  maxStakePerUser: z.union([z.string().regex(/^\d+(\.\d+)?$/), z.literal("")]).optional().nullable(),
  rewardFeePercent: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  cooldownSeconds: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const stakingPoolPatch = stakingPoolCreate.partial().extend({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).optional(),
});

r.get("/staking/pools", requireAdmin, async (_req, res) => {
  const pools = await listStakingPoolsAdmin();
  return res.json(pools);
});

r.post("/staking/pools", strictLimiter, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = stakingPoolCreate.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const maxRaw = parsed.data.maxStakePerUser;
  const maxStakePerUser =
    maxRaw === "" || maxRaw === undefined || maxRaw === null ? null : maxRaw;
  try {
    const id = await createStakingPool(
      {
        ...parsed.data,
        maxStakePerUser,
      },
      req.userEmail!,
    );
    return res.status(201).json({ id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "INVALID_FEE") return res.status(400).json({ error: msg });
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "DUPLICATE_SLUG" });
    }
    throw e;
  }
});

r.patch("/staking/pools/:id", strictLimiter, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = stakingPoolPatch.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const maxRaw = parsed.data.maxStakePerUser;
  const patch = {
    ...parsed.data,
    ...(maxRaw !== undefined
      ? { maxStakePerUser: maxRaw === "" || maxRaw === null ? null : maxRaw }
      : {}),
  };
  try {
    await updateStakingPool(routeParam(req.params.id), patch, req.userEmail!);
    return res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "INVALID_FEE" || msg === "EMPTY_PATCH") return res.status(400).json({ error: msg });
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "DUPLICATE_SLUG" });
    }
    throw e;
  }
});

r.delete("/staking/pools/:id", strictLimiter, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await deleteStakingPool(routeParam(req.params.id), req.userEmail!);
    return res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "POOL_HAS_STAKES") return res.status(409).json({ error: msg });
    throw e;
  }
});

r.get("/staking/export/stakes.csv", requireAdmin, async (req, res) => {
  const statusRaw = queryString(req.query.status);
  const filter =
    statusRaw === "ACTIVE" || statusRaw === "COMPLETED"
      ? { status: statusRaw as "ACTIVE" | "COMPLETED" }
      : undefined;
  const csv = await exportUserStakesCsv(filter);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="mcbuleli-stakes-${Date.now()}.csv"`);
  res.send("\uFEFF" + csv);
});

r.get("/staking/export/ledger.csv", requireAdmin, async (_req, res) => {
  const csv = await exportStakingTransactionsCsv();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="mcbuleli-staking-ledger-${Date.now()}.csv"`,
  );
  res.send("\uFEFF" + csv);
});

export default r;
