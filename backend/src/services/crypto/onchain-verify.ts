import bs58 from "bs58";
import { Contract, getAddress, Interface, JsonRpcProvider } from "ethers";
import { Decimal } from "@prisma/client/runtime/library";
import type { ChainNetwork } from "../../constants/schemaEnums.js";
import { env } from "../../config/env.js";
import {
  CHAIN_USDT_DECIMALS,
  defaultPublicRpc,
  rpcUrlFor,
  tronFullNodeUrl,
  USDT_CONTRACT,
} from "./chain-config.js";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type VerifyFailureCode =
  | "NOT_FOUND"
  | "NOT_CONFIRMED"
  | "WRONG_ASSET"
  | "WRONG_RECIPIENT"
  | "MEMO_MISMATCH"
  | "AMOUNT_BELOW_MIN"
  | "RPC_ERROR"
  | "PARSE_ERROR";

export type OnchainUsdtVerifyResult =
  | {
      ok: true;
      amount: Decimal;
      confirmations: number;
      raw: unknown;
    }
  | { ok: false; code: VerifyFailureCode; detail?: string; raw?: unknown };

function normalizeEvmTxid(txid: string): string {
  const t = txid.trim();
  if (t.startsWith("0x") || t.startsWith("0X")) return t.toLowerCase();
  if (/^[0-9a-fA-F]{64}$/.test(t)) return `0x${t.toLowerCase()}`;
  return t;
}

function normalizeTronTxid(txid: string): string {
  return txid.trim().toLowerCase().replace(/^0x/, "");
}

/** 20-byte EVM-style hex (no 0x) from a 32-byte log topic. */
function addressFromTopic(topic: string): string {
  const h = topic.replace(/^0x/i, "");
  return h.slice(-40).toLowerCase();
}

function tronBase58To20Hex(addressBase58: string): string {
  const buf = Buffer.from(bs58.decode(addressBase58));
  if (buf.length < 21) throw new Error("bad tron");
  return buf.subarray(1, 21).toString("hex").toLowerCase();
}

function tronContractBase58ToHex41(contractB58: string): string {
  const buf = Buffer.from(bs58.decode(contractB58));
  return buf.toString("hex").toLowerCase();
}

function tronHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const k = env().TRON_PRO_API_KEY;
  if (k) h["TRON-PRO-API-KEY"] = k;
  return h;
}

async function tronGetTransactionInfo(txid: string): Promise<unknown> {
  const base = tronFullNodeUrl().replace(/\/$/, "");
  const res = await fetch(`${base}/wallet/gettransactioninfobyid`, {
    method: "POST",
    headers: tronHeaders(),
    body: JSON.stringify({ value: txid }),
  });
  if (!res.ok) return { _httpError: res.status };
  return res.json() as Promise<unknown>;
}

async function tronCurrentBlock(): Promise<bigint> {
  const base = tronFullNodeUrl().replace(/\/$/, "");
  const res = await fetch(`${base}/wallet/getnowblock`, {
    method: "POST",
    headers: tronHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) return 0n;
  const j = (await res.json()) as { block_header?: { raw_data?: { number?: number } } };
  const n = j.block_header?.raw_data?.number;
  return n != null ? BigInt(n) : 0n;
}

async function verifyTronUsdt(input: {
  txid: string;
  platformAddressBase58: string;
  minAmount: Decimal;
  memoExpected: string | null | undefined;
}): Promise<OnchainUsdtVerifyResult> {
  const { txid, platformAddressBase58, minAmount, memoExpected } = input;
  let raw: unknown;
  try {
    raw = await tronGetTransactionInfo(txid);
  } catch (e) {
    return { ok: false, code: "RPC_ERROR", detail: e instanceof Error ? e.message : String(e) };
  }

  const row = raw as Record<string, unknown>;
  if (row._httpError) return { ok: false, code: "RPC_ERROR", raw };

  if (!row.id && !row.txID && Object.keys(row).length === 0) {
    return { ok: false, code: "NOT_FOUND", raw };
  }

  const receipt = row as {
    log?: Array<{ address?: string; topics?: string[]; data?: string }>;
    blockNumber?: number;
    result?: string;
    receipt?: { result?: string };
  };

  const result = receipt.receipt?.result ?? receipt.result;
  if (result && result !== "SUCCESS") {
    return { ok: false, code: "NOT_CONFIRMED", detail: `receipt=${String(result)}`, raw };
  }

  const usdtHex41 = tronContractBase58ToHex41(USDT_CONTRACT.TRC20);
  const dest20 = tronBase58To20Hex(platformAddressBase58);
  const logs = receipt.log ?? [];
  let best: { amount: Decimal; memoOk: boolean } | null = null;

  for (const log of logs) {
    const addr = (log.address ?? "").replace(/^0x/i, "");
    if (addr.toLowerCase() !== usdtHex41.toLowerCase()) continue;
    const topics = log.topics;
    if (!topics || topics.length < 3) continue;
    if (topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
    const to20 = addressFromTopic(topics[2]!);
    if (to20 !== dest20) continue;
    const data = (log.data ?? "0x").replace(/^0x/i, "");
    if (data.length < 64) continue;
    const valueHex = `0x${data.slice(0, 64)}`;
    const dec = 6;
    const v = BigInt(valueHex);
    const amount = new Decimal(v.toString()).div(new Decimal(10).pow(dec));
    const memoOk = !memoExpected?.trim() || true;
    if (!best || amount.greaterThan(best.amount)) best = { amount, memoOk };
  }

  if (!best) {
    return { ok: false, code: "WRONG_RECIPIENT", detail: "no USDT transfer to platform in tx", raw };
  }

  if (memoExpected?.trim()) {
    return { ok: false, code: "MEMO_MISMATCH", detail: "USDT TRC20 transfer has no on-chain memo field", raw };
  }

  const eps = new Decimal("0.000001");
  if (best.amount.add(eps).lessThan(minAmount)) {
    return { ok: false, code: "AMOUNT_BELOW_MIN", raw };
  }

  const blockNum = receipt.blockNumber;
  if (blockNum == null) {
    return { ok: false, code: "NOT_CONFIRMED", raw };
  }
  const head = await tronCurrentBlock();
  const conf = head > 0n ? Number(head - BigInt(blockNum) + 1n) : 0;

  return { ok: true, amount: best.amount, confirmations: conf, raw };
}

async function verifyEvmUsdt(input: {
  network: "ERC20" | "BEP20";
  txid: string;
  platformAddress: string;
  minAmount: Decimal;
  memoExpected: string | null | undefined;
}): Promise<OnchainUsdtVerifyResult> {
  const { network, txid: rawTxid, platformAddress, minAmount, memoExpected } = input;
  const rpc = rpcUrlFor(network) ?? defaultPublicRpc(network);
  const txid = normalizeEvmTxid(rawTxid);
  const provider = new JsonRpcProvider(rpc);
  let receipt: Awaited<ReturnType<JsonRpcProvider["getTransactionReceipt"]>>;
  try {
    receipt = await provider.getTransactionReceipt(txid);
  } catch (e) {
    return { ok: false, code: "RPC_ERROR", detail: e instanceof Error ? e.message : String(e) };
  }

  if (!receipt) return { ok: false, code: "NOT_FOUND" };
  if (receipt.status !== 1) return { ok: false, code: "NOT_CONFIRMED", raw: receipt };

  if (memoExpected?.trim()) {
    return { ok: false, code: "MEMO_MISMATCH", detail: "memo not supported for USDT on this network", raw: receipt };
  }

  const contractAddr = getAddress(USDT_CONTRACT[network]);
  const dest = getAddress(platformAddress);
  const iface = new Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);

  const token = new Contract(
    contractAddr,
    ["function decimals() view returns (uint8)"],
    provider,
  );
  let decimals = CHAIN_USDT_DECIMALS[network];
  try {
    decimals = Number(await token.decimals());
  } catch {
    /* use table default */
  }

  let amountMatched: Decimal | null = null;
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== contractAddr) continue;
    let parsed;
    try {
      parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
    } catch {
      continue;
    }
    if (!parsed || parsed.name !== "Transfer") continue;
    if (getAddress(parsed.args.to) !== dest) continue;
    const v = parsed.args.value as bigint;
    amountMatched = new Decimal(v.toString()).div(new Decimal(10).pow(decimals));
    break;
  }

  if (!amountMatched) {
    return { ok: false, code: "WRONG_RECIPIENT", detail: "no USDT Transfer to platform", raw: receipt };
  }

  const eps = new Decimal("0.000001");
  if (amountMatched.add(eps).lessThan(minAmount)) {
    return { ok: false, code: "AMOUNT_BELOW_MIN", raw: receipt };
  }

  const head = await provider.getBlockNumber();
  const conf = head - receipt.blockNumber + 1;

  return {
    ok: true,
    amount: amountMatched,
    confirmations: conf,
    raw: receipt,
  };
}

export function normalizeTxIdForStore(network: ChainNetwork, raw: string): string {
  if (network === "TRC20") return normalizeTronTxid(raw);
  return normalizeEvmTxid(raw);
}

export async function verifyUsdtIncomingPayment(input: {
  network: ChainNetwork;
  txidRaw: string;
  platformAddress: string;
  minAmount: Decimal;
  memoExpected?: string | null;
}): Promise<OnchainUsdtVerifyResult> {
  const { network, platformAddress, minAmount, memoExpected } = input;
  if (network === "TRC20") {
    return verifyTronUsdt({
      txid: normalizeTronTxid(input.txidRaw),
      platformAddressBase58: platformAddress.trim(),
      minAmount,
      memoExpected,
    });
  }
  if (network === "ERC20" || network === "BEP20") {
    return verifyEvmUsdt({
      network,
      txid: input.txidRaw,
      platformAddress: platformAddress.trim(),
      minAmount,
      memoExpected,
    });
  }
  return { ok: false, code: "PARSE_ERROR" };
}
