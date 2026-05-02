import { KycStatus, P2PDisputeStatus, TransactionType } from "../constants/schemaEnums.js";
import { prisma } from "../lib/prisma.js";
import {
  releaseLockedToBuyer,
  refundLockedToSeller,
  applyBalanceChange,
} from "./ledger.service.js";
function cryptoCodeFromAsset(a: "USDT" | "BTC") {
  return a === "BTC" ? "BTC" : "USDT";
}

export async function setKycStatus(
  userId: string,
  status: KycStatus,
  adminEmail: string,
) {
  await prisma.user.update({ where: { id: userId }, data: { kycStatus: status } });
  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: "KYC_UPDATE",
      targetType: "User",
      targetId: userId,
      metadata: { status },
    },
  });
}

export async function freezeUser(userId: string, adminEmail: string, frozen: boolean) {
  await prisma.user.update({ where: { id: userId }, data: { isFrozen: frozen } });
  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: frozen ? "FREEZE" : "UNFREEZE",
      targetType: "User",
      targetId: userId,
    },
  });
}

export async function resolveDispute(
  tradeId: string,
  resolution: P2PDisputeStatus,
  adminEmail: string,
) {
  const trade = await prisma.p2PTrade.findUnique({
    where: { id: tradeId },
    include: { offer: true, dispute: true },
  });
  if (!trade?.dispute || trade.dispute.status !== "OPEN") throw new Error("INVALID_DISPUTE");

  const cryptoCode = cryptoCodeFromAsset(trade.offer.cryptoAsset);

  if (resolution === "RESOLVED_BUYER") {
    await releaseLockedToBuyer(
      trade.sellerId,
      trade.buyerId,
      "CRYPTO",
      cryptoCode,
      trade.cryptoAmount,
      "P2PTrade",
      trade.id,
    );
    await prisma.p2PTrade.update({
      where: { id: tradeId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  } else if (resolution === "RESOLVED_SELLER") {
    await refundLockedToSeller(
      trade.sellerId,
      "CRYPTO",
      cryptoCode,
      trade.cryptoAmount,
      "P2PTrade",
      trade.id,
    );
    await prisma.p2PTrade.update({
      where: { id: tradeId },
      data: { status: "CANCELLED" },
    });
  } else {
    throw new Error("INVALID_RESOLUTION");
  }

  await prisma.p2PDispute.update({
    where: { tradeId },
    data: {
      status: resolution,
      resolvedAt: new Date(),
      resolution: adminEmail,
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: "DISPUTE_RESOLVE",
      targetType: "P2PTrade",
      targetId: tradeId,
      metadata: { resolution },
    },
  });
}

export async function approveWithdrawal(withdrawalId: string, adminEmail: string) {
  const w = await prisma.fiatWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w || w.status !== "PENDING") throw new Error("INVALID_WITHDRAWAL");

  await prisma.fiatWithdrawal.update({
    where: { id: withdrawalId },
    data: { status: "SUCCESS", reviewedBy: adminEmail },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: "WITHDRAW_APPROVE",
      targetType: "FiatWithdrawal",
      targetId: withdrawalId,
    },
  });

  return { ok: true };
}

export async function rejectWithdrawal(withdrawalId: string, adminEmail: string) {
  const w = await prisma.fiatWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w || w.status !== "PENDING") throw new Error("INVALID_WITHDRAWAL");

  const cur = w.currency.toString();
  await applyBalanceChange(
    {
      userId: w.userId,
      kind: "FIAT",
      currencyCode: cur,
      amount: w.amount,
      type: "WITHDRAW_REJECT_REFUND",
      referenceType: "FiatWithdrawal",
      referenceId: withdrawalId,
    },
    TransactionType.ADJUSTMENT,
    "SUCCESS",
  );

  await prisma.fiatWithdrawal.update({
    where: { id: withdrawalId },
    data: { status: "FAILED", reviewedBy: adminEmail },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminEmail,
      action: "WITHDRAW_REJECT",
      targetType: "FiatWithdrawal",
      targetId: withdrawalId,
    },
  });
}
