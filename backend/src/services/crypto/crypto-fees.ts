import { Decimal } from "@prisma/client/runtime/library";
import { env } from "../../config/env.js";

/** Minimum net USDT credited (deposit) or sent (withdraw), before/after fixed fee rules. */
export const CRYPTO_MIN_NET_USDT = new Decimal("10");

export function cryptoServiceFeeUsdt(): Decimal {
  return new Decimal(env().CRYPTO_SERVICE_FEE_USDT);
}

/**
 * UUID of the custodial user that receives USDT service-fee revenue (deposit/withdraw).
 * Falls back to `PLATFORM_STAKING_FEES_USER_ID` if unset.
 */
export function platformFeeTreasuryUserId(): string | null {
  const e = env();
  return e.PLATFORM_CRYPTO_FEES_USER_ID ?? e.PLATFORM_STAKING_FEES_USER_ID ?? null;
}

export function requirePlatformFeeTreasuryUserId(): string {
  const id = platformFeeTreasuryUserId();
  if (!id) throw new Error("PLATFORM_FEES_TREASURY_NOT_CONFIGURED");
  return id;
}
