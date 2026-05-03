/**
 * Client HTTP PawaPay Merchant API (v2).
 * @see https://docs.pawapay.io/
 */
import { env } from "../../config/env.js";

const DEFAULT_SANDBOX = "https://api.sandbox.pawapay.io";

export type PawaPayDepositBody = {
  depositId: string;
  amount: string;
  currency: string;
  correspondent: string;
  payer: { type: "MSISDN"; address: { value: string } };
  customerTimestamp: string;
  statementDescription: string;
};

export type PawaPayPayoutBody = {
  payoutId: string;
  amount: string;
  currency: string;
  country: string;
  correspondent: string;
  recipient: { type: "MSISDN"; address: { value: string } };
  customerTimestamp: string;
  statementDescription: string;
};

function baseUrl(): string {
  return env().PAWAPAY_BASE_URL ?? DEFAULT_SANDBOX;
}

function headers(extra?: Record<string, string>): HeadersInit {
  const apiKey = env().PAWAPAY_API_KEY;
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
  if (apiKey) {
    h.Authorization = `Bearer ${apiKey}`;
  }
  return h;
}

export async function pawapayRequestDeposit(body: PawaPayDepositBody): Promise<{ ok: boolean; status: number; json: unknown }> {
  const url = `${baseUrl().replace(/\/$/, "")}/v2/deposits`;
  const idempotencyKey = body.depositId;
  const res = await fetch(url, {
    method: "POST",
    headers: headers({
      "Idempotency-Key": idempotencyKey,
    }),
    body: JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

export async function pawapayRequestPayout(body: PawaPayPayoutBody): Promise<{ ok: boolean; status: number; json: unknown }> {
  const url = `${baseUrl().replace(/\/$/, "")}/v2/payouts`;
  const idempotencyKey = body.payoutId;
  const res = await fetch(url, {
    method: "POST",
    headers: headers({
      "Idempotency-Key": idempotencyKey,
    }),
    body: JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

/** Normalise MSISDN pour PawaPay (chiffres uniquement, sans +). */
export function normalizeMsisdn(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/^\+/, "").replace(/^00/, "");
}
