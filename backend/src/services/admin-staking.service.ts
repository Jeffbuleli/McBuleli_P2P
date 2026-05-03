import type { CryptoAsset, Prisma, StakeStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { applyRewardFee, computeGrossStakeReward } from "./staking.service.js";

function csvEscape(cell: string): string {
  const s = cell ?? "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: string[]): string {
  return cells.map(csvEscape).join(",");
}

export async function listStakingPoolsAdmin() {
  const rows = await prisma.stakingPool.findMany({
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    include: {
      _count: { select: { stakes: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    asset: p.asset,
    nameFr: p.nameFr,
    nameEn: p.nameEn,
    apyAnnual: p.apyAnnual.toString(),
    lockDays: p.lockDays,
    minAmount: p.minAmount.toString(),
    maxStakePerUser: p.maxStakePerUser?.toString() ?? null,
    rewardFeePercent: p.rewardFeePercent.toString(),
    cooldownSeconds: p.cooldownSeconds,
    isActive: p.isActive,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt.toISOString(),
    stakesCount: p._count.stakes,
  }));
}

type PoolCreateInput = {
  slug: string;
  asset: CryptoAsset;
  nameFr?: string | null;
  nameEn?: string | null;
  apyAnnual: string;
  lockDays: number;
  minAmount: string;
  maxStakePerUser?: string | null;
  rewardFeePercent?: string;
  cooldownSeconds?: number;
  isActive?: boolean;
  sortOrder?: number;
};

export async function createStakingPool(input: PoolCreateInput, adminEmail: string) {
  const rewardFeePercent = new Decimal(input.rewardFeePercent ?? "0");
  if (rewardFeePercent.lessThan(0) || rewardFeePercent.greaterThan(100)) throw new Error("INVALID_FEE");

  const row = await prisma.stakingPool.create({
    data: {
      slug: input.slug,
      asset: input.asset,
      nameFr: input.nameFr ?? null,
      nameEn: input.nameEn ?? null,
      apyAnnual: input.apyAnnual,
      lockDays: input.lockDays,
      minAmount: input.minAmount,
      maxStakePerUser: input.maxStakePerUser ?? null,
      rewardFeePercent,
      cooldownSeconds: input.cooldownSeconds ?? 0,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: "STAKING_POOL_CREATE",
      targetType: "StakingPool",
      targetId: row.id,
      metadata: { slug: row.slug },
    },
  });

  return row.id;
}

type PoolPatchInput = Partial<{
  slug: string;
  asset: CryptoAsset;
  nameFr: string | null;
  nameEn: string | null;
  apyAnnual: string;
  lockDays: number;
  minAmount: string;
  maxStakePerUser: string | null;
  rewardFeePercent: string;
  cooldownSeconds: number;
  isActive: boolean;
  sortOrder: number;
}>;

export async function updateStakingPool(poolId: string, patch: PoolPatchInput, adminEmail: string) {
  const data: Prisma.StakingPoolUpdateInput = {};

  if (patch.slug !== undefined) data.slug = patch.slug;
  if (patch.asset !== undefined) data.asset = patch.asset;
  if (patch.nameFr !== undefined) data.nameFr = patch.nameFr;
  if (patch.nameEn !== undefined) data.nameEn = patch.nameEn;
  if (patch.apyAnnual !== undefined) data.apyAnnual = patch.apyAnnual;
  if (patch.lockDays !== undefined) data.lockDays = patch.lockDays;
  if (patch.minAmount !== undefined) data.minAmount = patch.minAmount;
  if (patch.maxStakePerUser !== undefined) data.maxStakePerUser = patch.maxStakePerUser;
  if (patch.rewardFeePercent !== undefined) {
    const fp = new Decimal(patch.rewardFeePercent);
    if (fp.lessThan(0) || fp.greaterThan(100)) throw new Error("INVALID_FEE");
    data.rewardFeePercent = fp;
  }
  if (patch.cooldownSeconds !== undefined) data.cooldownSeconds = patch.cooldownSeconds;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;

  if (Object.keys(data).length === 0) throw new Error("EMPTY_PATCH");

  await prisma.stakingPool.update({
    where: { id: poolId },
    data,
  });

  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: "STAKING_POOL_UPDATE",
      targetType: "StakingPool",
      targetId: poolId,
      metadata: { patch },
    },
  });
}

export async function deleteStakingPool(poolId: string, adminEmail: string) {
  const cnt = await prisma.userStake.count({ where: { poolId } });
  if (cnt > 0) throw new Error("POOL_HAS_STAKES");

  await prisma.stakingPool.delete({ where: { id: poolId } });

  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: "STAKING_POOL_DELETE",
      targetType: "StakingPool",
      targetId: poolId,
    },
  });
}

export async function exportUserStakesCsv(filter?: { status?: StakeStatus }): Promise<string> {
  const rows = await prisma.userStake.findMany({
    where: filter?.status ? { status: filter.status } : undefined,
    include: {
      user: { select: { email: true, username: true } },
      pool: { select: { slug: true, asset: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 50_000,
  });

  const header = csvRow([
    "stake_id",
    "user_email",
    "username",
    "pool_slug",
    "asset",
    "amount_principal",
    "apy_snapshot_pct",
    "lock_days_snapshot",
    "reward_fee_pct_snapshot",
    "status",
    "started_at_utc",
    "matures_at_utc",
    "settled_at_utc",
    "gross_interest_estimated",
    "fee_on_interest_estimated",
    "net_interest_estimated_or_paid",
  ]);

  const lines = rows.map((r) => {
    const gross = computeGrossStakeReward(r.amount, r.apySnapshot, r.lockDaysSnapshot);
    const { feeAmount, netInterest } = applyRewardFee(gross, r.rewardFeePercentSnapshot);
    const netPaid = r.rewardAmount?.toString() ?? netInterest.toString();
    return csvRow([
      r.id,
      r.user.email,
      r.user.username,
      r.pool.slug,
      r.pool.asset,
      r.amount.toString(),
      r.apySnapshot.toString(),
      String(r.lockDaysSnapshot),
      r.rewardFeePercentSnapshot.toString(),
      r.status,
      r.startedAt.toISOString(),
      r.maturesAt.toISOString(),
      r.settledAt?.toISOString() ?? "",
      gross.toString(),
      feeAmount.toString(),
      netPaid,
    ]);
  });

  return [header, ...lines].join("\n");
}

/** Écritures staking : STAKE_LOCK, STAKE_EXIT, et frais trésorerie (ADJUSTMENT · STAKE_INTEREST_FEE). */
export async function exportStakingTransactionsCsv(): Promise<string> {
  const primary = await prisma.transaction.findMany({
    where: { type: { in: ["STAKE_LOCK", "STAKE_EXIT"] } },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50_000,
  });

  const adjustments = await prisma.transaction.findMany({
    where: { type: "ADJUSTMENT" },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 30_000,
  });

  const feeRows = adjustments.filter((t) => {
    const m = t.metadata as { ledgerType?: string } | undefined;
    return m?.ledgerType === "STAKE_INTEREST_FEE";
  });

  const merged = [...primary, ...feeRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const header = csvRow([
    "tx_reference_id",
    "type",
    "user_email",
    "amount",
    "currency",
    "created_at_utc",
    "ledger_type",
    "ref_type",
    "ref_id",
  ]);

  const lines = merged.map((t) => {
    const m = t.metadata as {
      ledgerType?: string;
      referenceType?: string;
      referenceId?: string;
      direction?: string;
    } | null;
    return csvRow([
      t.referenceId,
      t.type,
      t.user.email,
      t.amount.toString(),
      t.currency,
      t.createdAt.toISOString(),
      m?.ledgerType ?? "",
      m?.referenceType ?? "",
      m?.referenceId ?? "",
    ]);
  });

  return [header, ...lines].join("\n");
}
