import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { TransactionType, WalletKind } from "../constants/schemaEnums.js";
import { resolveTreasuryUserIdInTx } from "./staff-role.service.js";
import { applyBalanceChangeTx, InsufficientFundsError } from "./ledger.service.js";

const USDT = "USDT";
/** On-chain style precision for custodial USDT/BTC balances */
const ASSET_DECIMALS = 8;

export function roundAssetAmount(d: Decimal): Decimal {
  return d.toDecimalPlaces(ASSET_DECIMALS, Decimal.ROUND_DOWN);
}

export function computeGrossStakeReward(amount: Decimal, apyPercent: Decimal, lockDays: number): Decimal {
  return amount.mul(apyPercent.div(100)).mul(new Decimal(lockDays).div(365));
}

/** After fee on gross interest; amounts rounded down to avoid over-crediting. */
export function applyRewardFee(
  grossInterest: Decimal,
  feePercent: Decimal,
): { netInterest: Decimal; feeAmount: Decimal } {
  if (feePercent.lessThanOrEqualTo(0) || !feePercent.isFinite()) {
    return { netInterest: roundAssetAmount(grossInterest), feeAmount: new Decimal(0) };
  }
  const feeAmount = roundAssetAmount(grossInterest.mul(feePercent.div(100)));
  const net = roundAssetAmount(grossInterest.sub(feeAmount));
  return {
    netInterest: net.lessThan(0) ? new Decimal(0) : net,
    feeAmount,
  };
}

function currencyForAsset(asset: "USDT" | "BTC"): string {
  return asset === "BTC" ? "BTC" : USDT;
}

/** Tables `StakingPool` / `UserStake` absentes (migrations non appliquées sur cette base). */
export function isStakingSchemaMissing(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code !== "P2021") return false;
  const meta = e.meta as { table?: string; modelName?: string } | undefined;
  const blob = `${meta?.table ?? ""} ${meta?.modelName ?? ""} ${e.message}`;
  return /UserStake|StakingPool/i.test(blob);
}

export async function listPools(): Promise<
  {
    id: string;
    slug: string;
    asset: string;
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
  }[]
> {
  let rows;
  try {
    rows = await prisma.stakingPool.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { lockDays: "asc" }],
    });
  } catch (e) {
    if (isStakingSchemaMissing(e)) {
      console.warn("[staking] Table StakingPool absente — exécutez : npx prisma migrate deploy");
      return [];
    }
    throw e;
  }
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
  }));
}

export async function listMyStakes(userId: string) {
  try {
    await processDueStakes();
    const rows = await prisma.userStake.findMany({
      where: { userId },
      include: { pool: true },
      orderBy: { startedAt: "desc" },
      take: 100,
    });
    return rows.map((s) => {
    const feePct = s.rewardFeePercentSnapshot;
    let netInterest: Decimal;
    let projectedGrossReward: string | null = null;

    if (s.status === "COMPLETED" && s.rewardAmount != null) {
      netInterest = s.rewardAmount;
    } else {
      const gross = computeGrossStakeReward(s.amount, s.apySnapshot, s.lockDaysSnapshot);
      projectedGrossReward = gross.toString();
      netInterest = applyRewardFee(gross, feePct).netInterest;
    }
    const totalAtMaturity = roundAssetAmount(s.amount.add(netInterest));
    return {
      id: s.id,
      poolId: s.poolId,
      poolSlug: s.pool.slug,
      asset: s.pool.asset,
      amount: s.amount.toString(),
      apySnapshot: s.apySnapshot.toString(),
      lockDaysSnapshot: s.lockDaysSnapshot,
      rewardFeePercentSnapshot: feePct.toString(),
      startedAt: s.startedAt.toISOString(),
      maturesAt: s.maturesAt.toISOString(),
      status: s.status,
      rewardAmount: s.rewardAmount?.toString() ?? null,
      projectedGrossReward,
      projectedReward: netInterest.toString(),
      totalAtMaturity: totalAtMaturity.toString(),
      settledAt: s.settledAt?.toISOString() ?? null,
    };
  });
  } catch (e) {
    if (isStakingSchemaMissing(e)) {
      console.warn("[staking] Schéma staking incomplet — exécutez : npx prisma migrate deploy");
      return [];
    }
    throw e;
  }
}

export async function createStake(userId: string, poolId: string, amountStr: string): Promise<{ stakeId: string }> {
  try {
    const amount = new Decimal(amountStr);
    if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) throw new Error("INVALID_AMOUNT");

    const pool = await prisma.stakingPool.findUnique({ where: { id: poolId } });
    if (!pool || !pool.isActive) throw new Error("POOL_NOT_FOUND");

    const currencyCode = currencyForAsset(pool.asset);
    if (amount.lessThan(pool.minAmount)) throw new Error("AMOUNT_TOO_LOW");

    if (pool.maxStakePerUser) {
      const agg = await prisma.userStake.aggregate({
        where: { userId, poolId, status: "ACTIVE" },
        _sum: { amount: true },
      });
      const current = agg._sum.amount ?? new Decimal(0);
      if (current.add(amount).greaterThan(pool.maxStakePerUser)) throw new Error("ABOVE_MAX_PER_USER");
    }

    if (pool.cooldownSeconds > 0) {
      const last = await prisma.userStake.findFirst({
        where: { userId, poolId },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      });
      if (last) {
        const elapsedSec = (Date.now() - last.startedAt.getTime()) / 1000;
        if (elapsedSec < pool.cooldownSeconds) throw new Error("STAKE_COOLDOWN");
      }
    }

    const maturesAt = new Date();
    maturesAt.setUTCDate(maturesAt.getUTCDate() + pool.lockDays);

    try {
      const stake = await prisma.$transaction(async (tx) => {
        await applyBalanceChangeTx(
          tx,
          {
            userId,
            kind: WalletKind.CRYPTO,
            currencyCode,
            amount: amount.neg(),
            type: "STAKE_LOCK",
            referenceType: "StakingPool",
            referenceId: poolId,
            metadata: { poolSlug: pool.slug },
          },
          TransactionType.STAKE_LOCK,
        );

        return tx.userStake.create({
          data: {
            userId,
            poolId,
            amount,
            apySnapshot: pool.apyAnnual,
            lockDaysSnapshot: pool.lockDays,
            rewardFeePercentSnapshot: pool.rewardFeePercent,
            maturesAt,
          },
        });
      });
      return { stakeId: stake.id };
    } catch (e: unknown) {
      if (e instanceof InsufficientFundsError) throw e;
      throw e;
    }
  } catch (e: unknown) {
    if (isStakingSchemaMissing(e)) throw new Error("STAKING_SCHEMA_MISSING");
    throw e;
  }
}

async function settleOne(tx: Prisma.TransactionClient, stakeId: string): Promise<boolean> {
  const s = await tx.userStake.findUnique({
    where: { id: stakeId },
    include: { pool: true },
  });
  if (!s || s.status !== "ACTIVE") return false;
  const now = new Date();
  if (s.maturesAt > now) return false;

  const grossInterest = computeGrossStakeReward(s.amount, s.apySnapshot, s.lockDaysSnapshot);
  const { netInterest, feeAmount } = applyRewardFee(grossInterest, s.rewardFeePercentSnapshot);
  const totalReturn = roundAssetAmount(s.amount.add(netInterest));
  const currencyCode = currencyForAsset(s.pool.asset);

  const treasuryUserId = await resolveTreasuryUserIdInTx(tx);

  await applyBalanceChangeTx(
    tx,
    {
      userId: s.userId,
      kind: WalletKind.CRYPTO,
      currencyCode,
      amount: totalReturn,
      type: "STAKE_EXIT",
      referenceType: "UserStake",
      referenceId: stakeId,
      metadata: {
        principal: s.amount.toString(),
        grossInterest: grossInterest.toString(),
        rewardFeePercent: s.rewardFeePercentSnapshot.toString(),
        feeOnInterest: feeAmount.toString(),
        netInterest: netInterest.toString(),
        totalCredit: totalReturn.toString(),
        treasuryFeeTargetUserId: treasuryUserId ?? undefined,
      },
    },
    TransactionType.STAKE_EXIT,
  );

  if (treasuryUserId && feeAmount.greaterThan(0) && treasuryUserId !== s.userId) {
    const treasuryUser = await tx.user.findUnique({
      where: { id: treasuryUserId },
      select: { id: true, isBlacklisted: true },
    });
    if (treasuryUser && !treasuryUser.isBlacklisted) {
      await applyBalanceChangeTx(
        tx,
        {
          userId: treasuryUserId,
          kind: WalletKind.CRYPTO,
          currencyCode,
          amount: feeAmount,
          type: "STAKE_INTEREST_FEE",
          referenceType: "UserStake",
          referenceId: stakeId,
          metadata: {
            sourceUserId: s.userId,
            poolSlug: s.pool.slug,
          },
        },
        TransactionType.ADJUSTMENT,
      );
    } else if (!treasuryUser) {
      console.warn(
        `[staking] compte trésorerie ${treasuryUserId} introuvable — frais non crédités pour stake ${stakeId}`,
      );
    } else if (treasuryUser.isBlacklisted) {
      console.warn(`[staking] compte trésorerie blacklisté — frais non crédités pour stake ${stakeId}`);
    }
  }

  await tx.userStake.update({
    where: { id: stakeId },
    data: {
      status: "COMPLETED",
      rewardAmount: netInterest,
      settledAt: now,
    },
  });
  return true;
}

/** Credits principal + net interest for stakes past maturity (custodial simple interest). */
export async function processDueStakes(): Promise<void> {
  const now = new Date();
  let due: { id: string }[];
  try {
    due = await prisma.userStake.findMany({
      where: { status: "ACTIVE", maturesAt: { lte: now } },
      select: { id: true },
      take: 200,
    });
  } catch (e) {
    if (isStakingSchemaMissing(e)) {
      return;
    }
    throw e;
  }
  for (const { id } of due) {
    try {
      await prisma.$transaction(async (tx) => {
        await settleOne(tx, id);
      });
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (code === "P1001") return;
      console.error("[staking] settle failed", id, e);
    }
  }
}
