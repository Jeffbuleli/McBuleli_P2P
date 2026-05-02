import { ethers } from "ethers";

/** Validate EVM address format — use before accepting withdrawal destinations. */
export function isValidEvmAddress(addr: string): boolean {
  return ethers.isAddress(addr);
}
