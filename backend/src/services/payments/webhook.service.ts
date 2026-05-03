import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { TransactionType } from "../../constants/schemaEnums.js";
import { applyBalanceChange, applyBalanceChangeTx } from "../ledger.service.js";

function logWebhook(kind: string, payload: unknown) {
  console.info(`[pawapay:webhook:${kind}]`, JSON.stringify(payload));
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

/** Statuts finaux succès dépôt — fonds reçus (ne pas créditer sur seul ACCEPTED API). */
function isDepositSuccessStatus(status: string): boolean {
  return status.toUpperCase() === "COMPLETED";
}

function isDepositFailStatus(status: string): boolean {
  const s = status.toUpperCase();
  return ["FAILED", "REJECTED", "CANCELLED", "DECLINED"].includes(s);
}

function isPayoutSuccessStatus(status: string): boolean {
  return status.toUpperCase() === "COMPLETED";
}

function isPayoutFailStatus(status: string): boolean {
  const s = status.toUpperCase();
  return ["FAILED", "REJECTED", "CANCELLED", "DECLINED"].includes(s);
}

async function refundWithdrawalIfNeeded(
  w: { id: string; userId: string; amount: Decimal; currency: string },
  reason: string,
): Promise<void> {
  const u = await prisma.fiatWithdrawal.updateMany({
    where: { id: w.id, status: "PENDING" },
    data: {
      status: "FAILED",
      failureReason: reason,
      lastWebhookAt: new Date(),
    },
  });
  if (u.count === 0) return;

  await prisma.transaction.updateMany({
    where: {
      userId: w.userId,
      referenceId: w.id,
      type: "WITHDRAW_FIAT",
      status: "PENDING",
    },
    data: { status: "FAILED" },
  });

  await applyBalanceChange(
    {
      userId: w.userId,
      kind: "FIAT",
      currencyCode: String(w.currency),
      amount: w.amount,
      type: "WITHDRAW_REVERSAL",
      referenceType: "FiatWithdrawal",
      referenceId: w.id,
      metadata: { reason },
    },
    TransactionType.ADJUSTMENT,
    "SUCCESS",
    { transactionReferenceId: `REFUND_${w.id}` },
  );
}

/**
 * Traite les callbacks PawaPay (dépôt ou retrait) — idempotent.
 */
export async function processPawapayWebhookPayload(body: unknown): Promise<{ handled: string }> {
  if (!body || typeof body !== "object") throw new Error("INVALID_BODY");
  const o = body as Record<string, unknown>;

  if (typeof o.depositId === "string") {
    return handleDepositCallback(o);
  }
  if (typeof o.payoutId === "string") {
    return handlePayoutCallback(o);
  }

  throw new Error("UNKNOWN_CALLBACK_SHAPE");
}

async function handleDepositCallback(o: Record<string, unknown>): Promise<{ handled: string }> {
  const depositId = o.depositId as string;
  const statusRaw = getString(o, "status") ?? "";
  const status = statusRaw.toUpperCase();

  logWebhook("deposit", { depositId, status });

  const dep = await prisma.fiatDeposit.findUnique({ where: { id: depositId } });
  if (!dep) {
    console.warn("[pawapay] deposit unknown id", depositId);
    return { handled: "deposit_unknown" };
  }

  if (dep.status === "SUCCESS") {
    return { handled: "deposit_duplicate" };
  }

  const amountStr =
    getString(o, "requestedAmount") ?? getString(o, "amount") ?? dep.amount.toString();
  const amount = new Decimal(amountStr);
  const currency = (getString(o, "currency") ?? dep.currency) as string;

  const providerTx =
    getString(o, "providerTransactionId") ??
    (typeof o.providerTransactionId === "string" ? o.providerTransactionId : undefined);

  const payloadJson = o as Prisma.InputJsonValue;

  if (isDepositFailStatus(status)) {
    await prisma.fiatDeposit.update({
      where: { id: dep.id },
      data: {
        status: "FAILED",
        pawapayPayload: payloadJson,
        failureReason: status,
        externalRef: providerTx ?? dep.externalRef,
        lastWebhookAt: new Date(),
      },
    });
    return { handled: "deposit_failed" };
  }

  if (!isDepositSuccessStatus(status)) {
    await prisma.fiatDeposit.update({
      where: { id: dep.id },
      data: {
        pawapayPayload: payloadJson,
        lastWebhookAt: new Date(),
      },
    });
    return { handled: "deposit_non_final" };
  }

  let credited = false;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.fiatDeposit.updateMany({
      where: { id: dep.id, status: "PENDING" },
      data: {
        status: "SUCCESS",
        pawapayPayload: payloadJson,
        externalRef: providerTx ?? dep.externalRef,
        lastWebhookAt: new Date(),
      },
    });

    if (updated.count === 0) return;

    await applyBalanceChangeTx(
      tx,
      {
        userId: dep.userId,
        kind: "FIAT",
        currencyCode: currency,
        amount,
        type: "FIAT_DEPOSIT",
        referenceType: "FiatDeposit",
        referenceId: dep.id,
        metadata: { pawapayStatus: status },
      },
      TransactionType.DEPOSIT_FIAT,
      "SUCCESS",
      { transactionReferenceId: `DEP_${dep.id}` },
    );
    credited = true;
  });

  if (!credited) {
    const after = await prisma.fiatDeposit.findUnique({ where: { id: dep.id } });
    if (after?.status === "SUCCESS") return { handled: "deposit_duplicate" };
    return { handled: "deposit_non_final" };
  }

  return { handled: "deposit_success" };
}

async function handlePayoutCallback(o: Record<string, unknown>): Promise<{ handled: string }> {
  const payoutId = o.payoutId as string;
  const statusRaw = getString(o, "status") ?? "";
  const status = statusRaw.toUpperCase();

  logWebhook("payout", { payoutId, status });

  const w = await prisma.fiatWithdrawal.findUnique({ where: { id: payoutId } });
  if (!w) {
    console.warn("[pawapay] payout unknown id", payoutId);
    return { handled: "payout_unknown" };
  }

  if (w.status === "SUCCESS") {
    return { handled: "payout_duplicate" };
  }

  const payloadJson = o as Prisma.InputJsonValue;

  if (isPayoutSuccessStatus(status)) {
    const n = await prisma.fiatWithdrawal.updateMany({
      where: { id: w.id, status: "PENDING" },
      data: {
        status: "SUCCESS",
        pawapayPayload: payloadJson,
        lastWebhookAt: new Date(),
      },
    });

    if (n.count === 0) {
      return { handled: "payout_race_duplicate" };
    }

    await prisma.transaction.updateMany({
      where: {
        userId: w.userId,
        referenceId: w.id,
        type: "WITHDRAW_FIAT",
        status: "PENDING",
      },
      data: { status: "SUCCESS" },
    });

    return { handled: "payout_success" };
  }

  if (isPayoutFailStatus(status)) {
    await prisma.fiatWithdrawal.update({
      where: { id: w.id },
      data: {
        pawapayPayload: payloadJson,
        lastWebhookAt: new Date(),
      },
    });
    await refundWithdrawalIfNeeded(w, `PAYOUT_${status}`);
    return { handled: "payout_failed" };
  }

  await prisma.fiatWithdrawal.update({
    where: { id: w.id },
    data: {
      pawapayPayload: payloadJson,
      lastWebhookAt: new Date(),
    },
  });
  return { handled: "payout_non_final" };
}
