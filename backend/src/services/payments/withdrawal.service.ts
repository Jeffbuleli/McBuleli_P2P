import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { TransactionType } from "../../constants/schemaEnums.js";
import {
  applyBalanceChange,
  applyBalanceChangeTx,
  getOrCreateWallet,
  InsufficientFundsError,
} from "../ledger.service.js";
import { getDailyWithdrawTotal, incrementDailyWithdraw } from "../../lib/redis.js";
import { flagSuspicious } from "../risk.service.js";
import { pawapayRequestPayout, normalizeMsisdn } from "./pawapay.client.js";

const DEFAULT_DAILY_LIMIT = new Decimal("500000");

function correspondentForPayoutResolved(currencyCode: string): string {
  const e = env();
  const map: Record<string, string | undefined> = {
    CDF: e.PAWAPAY_PAYOUT_CORRESPONDENT_CDF ?? e.PAWAPAY_CORRESPONDENT_CDF,
    USD: e.PAWAPAY_PAYOUT_CORRESPONDENT_USD ?? e.PAWAPAY_CORRESPONDENT_USD,
    EUR: e.PAWAPAY_PAYOUT_CORRESPONDENT_EUR ?? e.PAWAPAY_CORRESPONDENT_EUR,
  };
  const v = map[currencyCode];
  if (!v) throw new Error("PAWAPAY_PAYOUT_CORRESPONDENT_NOT_CONFIGURED");
  return v;
}

function countryForCurrency(currencyCode: string): string {
  const e = env();
  if (e.PAWAPAY_PAYOUT_COUNTRY) return e.PAWAPAY_PAYOUT_COUNTRY;
  if (currencyCode === "CDF") return "COD";
  return "COD";
}

async function refundWithdrawalDebit(withdrawalId: string, userId: string, amount: Decimal, currencyCode: string) {
  await applyBalanceChange(
    {
      userId,
      kind: "FIAT",
      currencyCode,
      amount,
      type: "WITHDRAW_REVERSAL",
      referenceType: "FiatWithdrawal",
      referenceId: withdrawalId,
      metadata: { reason: "PAYOUT_HTTP_REJECTED" },
    },
    TransactionType.ADJUSTMENT,
    "SUCCESS",
    { transactionReferenceId: `REFUND_${withdrawalId}` },
  );
}

/**
 * Débite le wallet (ledger + Transaction PENDING), crée FiatWithdrawal, appelle payout PawaPay.
 * Si l’appel API échoue, rembourse immédiatement.
 */
export async function requestWithdrawal(
  userId: string,
  phoneNumber: string,
  amountStr: string,
  currencyCode: string,
) {
  const amount = new Decimal(amountStr);
  if (amount.lessThanOrEqualTo(0)) throw new Error("INVALID_AMOUNT");

  const cfg = await prisma.systemConfig.findUnique({ where: { id: "singleton" } });
  const limit = cfg?.dailyWithdrawLimitFiat ?? DEFAULT_DAILY_LIMIT;

  const today = await getDailyWithdrawTotal(userId);
  if (new Decimal(today).add(amount).greaterThan(limit)) {
    await flagSuspicious(userId, "WITHDRAW_LIMIT", { amount: amountStr, today });
    throw new Error("DAILY_LIMIT");
  }

  await getOrCreateWallet(userId, "FIAT", currencyCode);
  const msisdn = normalizeMsisdn(phoneNumber);
  if (msisdn.length < 8) throw new Error("INVALID_PHONE");

  const correspondent = correspondentForPayoutResolved(currencyCode);
  const country = countryForCurrency(currencyCode);

  const withdrawal = await prisma.$transaction(async (tx) => {
    const w = await tx.fiatWithdrawal.create({
      data: {
        userId,
        amount,
        currency: currencyCode as "CDF" | "USD" | "EUR",
        destinationMsisdn: msisdn,
        correspondent,
        status: "PENDING",
      },
    });

    try {
      await applyBalanceChangeTx(
        tx,
        {
          userId,
          kind: "FIAT",
          currencyCode,
          amount: amount.neg(),
          type: "WITHDRAW_REQUEST",
          referenceType: "FiatWithdrawal",
          referenceId: w.id,
        },
        TransactionType.WITHDRAW_FIAT,
        "PENDING",
        { transactionReferenceId: w.id },
      );
    } catch (e) {
      if (e instanceof InsufficientFundsError) throw new Error("INSUFFICIENT_FUNDS");
      throw e;
    }

    return w;
  });

  await incrementDailyWithdraw(userId, amount.toNumber());

  const e = env();
  if (!e.PAWAPAY_API_KEY) {
    console.warn("[pawapay] PAWAPAY_API_KEY missing — withdrawal debited, pending manual payout.");
    return {
      withdrawal,
      note: "PAWAPAY_NOT_CONFIGURED_PENDING_MANUAL",
    };
  }

  const payoutBody = {
    payoutId: withdrawal.id,
    amount: amount.toFixed(2),
    currency: currencyCode,
    country,
    correspondent,
    recipient: { type: "MSISDN" as const, address: { value: msisdn } },
    customerTimestamp: new Date().toISOString(),
    statementDescription: "McBuleli payout",
  };

  const res = await pawapayRequestPayout(payoutBody);

  await prisma.fiatWithdrawal.update({
    where: { id: withdrawal.id },
    data: {
      pawapayPayload: res.json as object,
      ...(res.ok ? {} : { status: "FAILED", failureReason: `HTTP_${res.status}` }),
    },
  });

  if (!res.ok) {
    await prisma.fiatWithdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "FAILED", failureReason: `PAWAPAY_HTTP_${res.status}` },
    });
    await prisma.transaction.updateMany({
      where: {
        userId,
        referenceId: withdrawal.id,
        type: "WITHDRAW_FIAT",
        status: "PENDING",
      },
      data: { status: "FAILED" },
    });
    await refundWithdrawalDebit(withdrawal.id, userId, amount, currencyCode);
    throw new Error(`PAWAPAY_PAYOUT_REJECTED:${res.status}`);
  }

  return {
    withdrawal: await prisma.fiatWithdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } }),
    pawapay: { ok: res.ok, status: res.status, body: res.json },
  };
}
