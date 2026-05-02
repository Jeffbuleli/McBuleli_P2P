import { createHmac, timingSafeEqual } from "crypto";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { applyBalanceChange } from "./ledger.service.js";
import { TransactionType } from "../constants/schemaEnums.js";

/**
 * Verify webhook signature (HMAC-SHA256 of raw body) — adjust to PawaPay docs when integrating live.
 */
export function verifyPawapaySignature(rawBody: string, signatureHeader: string | undefined): boolean {
  const secret = env().PAWAPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Credit user fiat when deposit confirmed — idempotent on externalRef */
export async function handleDepositWebhook(payload: {
  externalRef: string;
  status: "SUCCESS" | "FAILED";
  amount?: string;
  currency?: string;
}) {
  const dep = await prisma.fiatDeposit.findFirst({
    where: { externalRef: payload.externalRef },
  });
  if (!dep || dep.status === "SUCCESS") return { ok: true, duplicate: true };

  if (payload.status !== "SUCCESS") {
    await prisma.fiatDeposit.update({
      where: { id: dep.id },
      data: { status: "FAILED", pawapayPayload: payload as object },
    });
    return { ok: true };
  }

  const currency = (payload.currency ?? dep.currency) as string;
  const amount = new Decimal(payload.amount ?? dep.amount);

  await prisma.$transaction(async (tx) => {
    await tx.fiatDeposit.update({
      where: { id: dep.id },
      data: { status: "SUCCESS", pawapayPayload: payload as object },
    });
  });

  await applyBalanceChange(
    {
      userId: dep.userId,
      kind: "FIAT",
      currencyCode: currency,
      amount,
      type: "FIAT_DEPOSIT",
      referenceType: "FiatDeposit",
      referenceId: dep.id,
    },
    TransactionType.DEPOSIT_FIAT,
    "SUCCESS",
  );

  return { ok: true };
}

export async function initiatePayoutRequest(withdrawalId: string): Promise<{ queued: boolean }> {
  const w = await prisma.fiatWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w || w.status !== "PENDING") return { queued: false };
  if (!env().PAWAPAY_API_KEY) return { queued: false };
  // Real implementation: POST to PawaPay payouts endpoint with signed request
  return { queued: true };
}
