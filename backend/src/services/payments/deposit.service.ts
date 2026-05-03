import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { getOrCreateWallet } from "../ledger.service.js";
import { pawapayRequestDeposit, normalizeMsisdn } from "./pawapay.client.js";

function correspondentForCurrency(code: string): string | null {
  const e = env();
  const map: Record<string, string | undefined> = {
    CDF: e.PAWAPAY_CORRESPONDENT_CDF,
    USD: e.PAWAPAY_CORRESPONDENT_USD,
    EUR: e.PAWAPAY_CORRESPONDENT_EUR,
  };
  return map[code] ?? null;
}

/**
 * Crée un dépôt PENDING, appelle PawaPay — aucun crédit avant webhook SUCCESS.
 */
export async function initiateDeposit(userId: string, phoneNumber: string, amountStr: string, currencyCode: string) {
  const amount = new Decimal(amountStr);
  if (amount.lessThanOrEqualTo(0)) throw new Error("INVALID_AMOUNT");

  const correspondent = correspondentForCurrency(currencyCode);
  if (!correspondent) {
    throw new Error("PAWAPAY_CORRESPONDENT_NOT_CONFIGURED");
  }

  await getOrCreateWallet(userId, "FIAT", currencyCode);

  const msisdn = normalizeMsisdn(phoneNumber);
  if (msisdn.length < 8) throw new Error("INVALID_PHONE");

  const dep = await prisma.fiatDeposit.create({
    data: {
      userId,
      amount,
      currency: currencyCode as "CDF" | "USD" | "EUR",
      phoneNumber: msisdn,
      correspondent,
      status: "PENDING",
    },
  });

  const cfg = env();
  if (!cfg.PAWAPAY_API_KEY) {
    console.warn("[pawapay] PAWAPAY_API_KEY missing — deposit recorded, no upstream call.");
    return {
      deposit: dep,
      note: "PAWAPAY_NOT_CONFIGURED",
    };
  }

  const body = {
    depositId: dep.id,
    amount: amount.toFixed(2),
    currency: currencyCode,
    correspondent,
    payer: { type: "MSISDN" as const, address: { value: msisdn } },
    customerTimestamp: new Date().toISOString(),
    statementDescription: "McBuleli deposit",
  };

  const res = await pawapayRequestDeposit(body);

  await prisma.fiatDeposit.update({
    where: { id: dep.id },
    data: {
      pawapayPayload: res.json as object,
      ...(res.ok ? {} : { status: "FAILED", failureReason: `HTTP_${res.status}` }),
    },
  });

  if (!res.ok) {
    throw new Error(`PAWAPAY_DEPOSIT_REJECTED:${res.status}`);
  }

  return {
    deposit: await prisma.fiatDeposit.findUniqueOrThrow({ where: { id: dep.id } }),
    pawapay: { ok: res.ok, status: res.status, body: res.json },
  };
}
