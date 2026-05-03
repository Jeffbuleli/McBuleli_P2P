import { getAddress, isAddress as ethersIsAddress } from "ethers";
import type { ChainNetwork } from "../../constants/schemaEnums.js";

const TRON_BASE58_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export function validateDestinationAddress(network: ChainNetwork, address: string): boolean {
  const a = address.trim();
  if (network === "TRC20") return TRON_BASE58_RE.test(a);
  if (network === "ERC20" || network === "BEP20") {
    if (!ethersIsAddress(a)) return false;
    try {
      getAddress(a);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
