import type { ChainNetwork } from "../../constants/schemaEnums.js";
import type { CryptoAsset } from "@prisma/client";
import { env } from "../../config/env.js";

/** Canonical USDT contract addresses per network (validation targets). */
export const USDT_CONTRACT: Record<ChainNetwork, string> = {
  TRC20: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  ERC20: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  BEP20: "0x55d398326f99059fF775485246099027B3197955",
};

export const CHAIN_USDT_DECIMALS: Record<ChainNetwork, number> = {
  TRC20: 6,
  ERC20: 6,
  BEP20: 18,
};

export function rpcUrlFor(network: ChainNetwork): string | undefined {
  const e = env();
  if (network === "ERC20") return e.ETH_MAINNET_RPC_URL;
  if (network === "BEP20") return e.BSC_MAINNET_RPC_URL;
  return undefined;
}

export function defaultPublicRpc(network: ChainNetwork): string {
  if (network === "ERC20") return "https://eth.llamarpc.com";
  if (network === "BEP20") return "https://bsc-dataseed.binance.org";
  return "https://api.trongrid.io";
}

export function custodialDepositAddress(asset: CryptoAsset, network: ChainNetwork): string | null {
  const e = env();
  if (asset !== "USDT") return null;
  switch (network) {
    case "TRC20":
      return e.CRYPTO_DEPOSIT_USDT_TRC20_ADDRESS?.trim() || null;
    case "ERC20":
      return e.CRYPTO_DEPOSIT_USDT_ERC20_ADDRESS?.trim() || null;
    case "BEP20":
      return e.CRYPTO_DEPOSIT_USDT_BEP20_ADDRESS?.trim() || null;
    default:
      return null;
  }
}

export function tronFullNodeUrl(): string {
  const e = env();
  return e.TRON_FULLNODE_URL ?? "https://api.trongrid.io";
}
