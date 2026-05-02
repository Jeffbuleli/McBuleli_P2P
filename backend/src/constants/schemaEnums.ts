/**
 * Runtime enum values mirroring `prisma/schema.prisma`.
 * Use these instead of importing enums from `@prisma/client` so the server starts even if
 * `prisma generate` has not run yet (always run `npx prisma generate` after install).
 */
export const TransactionType = {
  DEPOSIT_FIAT: "DEPOSIT_FIAT",
  WITHDRAW_FIAT: "WITHDRAW_FIAT",
  INTERNAL_TRANSFER_OUT: "INTERNAL_TRANSFER_OUT",
  INTERNAL_TRANSFER_IN: "INTERNAL_TRANSFER_IN",
  P2P_ESCROW_LOCK: "P2P_ESCROW_LOCK",
  P2P_ESCROW_RELEASE: "P2P_ESCROW_RELEASE",
  P2P_REFUND: "P2P_REFUND",
  ADJUSTMENT: "ADJUSTMENT",
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const WalletKind = {
  CRYPTO: "CRYPTO",
  FIAT: "FIAT",
} as const;
export type WalletKind = (typeof WalletKind)[keyof typeof WalletKind];

export const KycStatus = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;
export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];

export const P2POfferSide = {
  BUY: "BUY",
  SELL: "SELL",
} as const;
export type P2POfferSide = (typeof P2POfferSide)[keyof typeof P2POfferSide];

export const P2PDisputeStatus = {
  OPEN: "OPEN",
  RESOLVED_BUYER: "RESOLVED_BUYER",
  RESOLVED_SELLER: "RESOLVED_SELLER",
  CANCELLED: "CANCELLED",
} as const;
export type P2PDisputeStatus = (typeof P2PDisputeStatus)[keyof typeof P2PDisputeStatus];
