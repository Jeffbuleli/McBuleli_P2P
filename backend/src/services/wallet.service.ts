import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { TransactionType, WalletKind } from "../constants/schemaEnums.js";
import {
  getOrCreateWallet,
  transferInternalAtomic,
  applyBalanceChange,
} from "./ledger.service.js";
import { newReference } from "../utils/refs.js";
import { getDailyWithdrawTotal, incrementDailyWithdraw } from "../lib/redis.js";
import { env } from "../config/env.js";
import { flagSuspicious } from "./risk.service.js";

export async function getBalances(userId: string) {
  return prisma.walletAccount.findMany({ where: { userId } });
}

export async function internalTransfer(
  fromUserId: string,
  toIdentifier: string,
  amountStr: string,
  currencyCode: string,
  kind: WalletKind,
) {
  const amount = new Decimal(amountStr);
  if (amount.lessThanOrEqualTo(0)) throw new Error("INVALID_AMOUNT");

  const toUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: toIdentifier.toLowerCase() }, { username: toIdentifier.toLowerCase() }],
    },
  });
  if (!toUser) throw new Error("USER_NOT_FOUND");
  if (toUser.id === fromUserId) throw new Error("SELF_TRANSFER");
  if (toUser.isFrozen || toUser.isBlacklisted) throw new Error("TARGET_BLOCKED");

  const ref = newReference("TRF");
  await getOrCreateWallet(fromUserId, kind, currencyCode);
  await getOrCreateWallet(toUser.id, kind, currencyCode);

  await transferInternalAtomic({
    fromUserId,
    toUserId: toUser.id,
    kind,
    currencyCode,
    amount,
    referenceId: ref,
    txTypeOut: TransactionType.INTERNAL_TRANSFER_OUT,
    txTypeIn: TransactionType.INTERNAL_TRANSFER_IN,
  });

  return prisma.internalTransfer.create({
    data: {
      referenceId: ref,
      fromUserId,
      toUserId: toUser.id,
      amount,
      currency: `${kind}:${currencyCode}`,
    },
  });
}

const DEFAULT_DAILY_LIMIT = new Decimal("500000");

export async function requestFiatWithdraw(
  userId: string,
  amountStr: string,
  currencyCode: string,
  destinationMsisdn: string,
) {
  const amount = new Decimal(amountStr);
  const cfg = await prisma.systemConfig.findUnique({ where: { id: "singleton" } });
  const limit = cfg?.dailyWithdrawLimitFiat ?? DEFAULT_DAILY_LIMIT;

  const today = await getDailyWithdrawTotal(userId);
  if (new Decimal(today).add(amount).greaterThan(limit)) {
    await flagSuspicious(userId, "WITHDRAW_LIMIT", { amount: amountStr, today });
    throw new Error("DAILY_LIMIT");
  }

  await getOrCreateWallet(userId, "FIAT", currencyCode);
  await applyBalanceChange(
    {
      userId,
      kind: "FIAT",
      currencyCode,
      amount: amount.neg(),
      type: "WITHDRAW_REQUEST",
      referenceType: "FiatWithdrawal",
      referenceId: newReference("FW"),
    },
    TransactionType.WITHDRAW_FIAT,
    "PENDING",
  );

  const row = await prisma.fiatWithdrawal.create({
    data: {
      userId,
      amount,
      currency: currencyCode as "CDF" | "USD" | "EUR",
      destinationMsisdn,
      status: "PENDING",
    },
  });

  await incrementDailyWithdraw(userId, amount.toNumber());

  if (!env().PAWAPAY_API_KEY) {
    return { withdrawal: row, note: "PAWAPAY_NOT_CONFIGURED_PENDING_MANUAL" };
  }

  return { withdrawal: row };
}

export async function initiateFiatDeposit(userId: string, amountStr: string, currencyCode: string) {
  const amount = new Decimal(amountStr);
  await getOrCreateWallet(userId, "FIAT", currencyCode);
  const dep = await prisma.fiatDeposit.create({
    data: {
      userId,
      amount,
      currency: currencyCode as "CDF" | "USD" | "EUR",
      status: "PENDING",
      externalRef: newReference("DEP"),
    },
  });
  return dep;
}
