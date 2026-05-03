import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __envDir = dirname(fileURLToPath(import.meta.url));
/** Toujours `backend/.env` par rapport à ce fichier (`src/config` → `../..`). */
const envNextToPackage = join(__envDir, "..", "..", ".env");
/** Si la commande est lancée depuis `backend/`, préfère le `.env` du cwd (fichier réellement édité / sauvegardé). */
const envInCwd = join(process.cwd(), ".env");
const envFile =
  basename(process.cwd()) === "backend" && existsSync(envInCwd) ? envInCwd : envNextToPackage;

config({ path: envFile, override: true });

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES: z.string().default("7d"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),
  ENCRYPTION_KEY: z.string().min(32),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  ADMIN_EMAILS: z.string().optional(),
  /** User id (UUID) that receives staking interest fees as ADJUSTMENT credits; optional. */
  PLATFORM_STAKING_FEES_USER_ID: z.string().uuid().optional(),
  /** User id (UUID) that receives USDT crypto deposit/withdraw service fees; defaults to PLATFORM_STAKING_FEES_USER_ID. */
  PLATFORM_CRYPTO_FEES_USER_ID: z.string().uuid().optional(),
  PAWAPAY_API_KEY: z.string().optional(),
  PAWAPAY_WEBHOOK_SECRET: z.string().optional(),
  /** Démo / intégration : toujours sandbox. Prod uniquement : https://api.pawapay.io */
  PAWAPAY_BASE_URL: z.string().url().default("https://api.sandbox.pawapay.io"),
  /** URL publique des webhooks (documentation / dashboard PawaPay) */
  CALLBACK_URL: z.string().url().optional(),
  /** Correspondant Mobile Money pour dépôt (ex. ORANGE_MOMO_COD) — par devise */
  PAWAPAY_CORRESPONDENT_CDF: z.string().optional(),
  PAWAPAY_CORRESPONDENT_USD: z.string().optional(),
  PAWAPAY_CORRESPONDENT_EUR: z.string().optional(),
  /** Correspondant pour retraits (si différent du dépôt) */
  PAWAPAY_PAYOUT_CORRESPONDENT_CDF: z.string().optional(),
  PAWAPAY_PAYOUT_CORRESPONDENT_USD: z.string().optional(),
  PAWAPAY_PAYOUT_CORRESPONDENT_EUR: z.string().optional(),
  /** Code pays ISO pour payouts (ex. COD pour RDC) */
  PAWAPAY_PAYOUT_COUNTRY: z.string().length(3).optional(),
  BINANCE_API_KEY: z.string().optional(),
  BINANCE_API_SECRET: z.string().optional(),

  /** TronGrid / fullnode (TRC20) */
  TRON_PRO_API_KEY: z.string().optional(),
  /** Optional custom Tron fullnode; default public TronGrid */
  TRON_FULLNODE_URL: z.string().url().optional(),

  /** EVM JSON-RPC (ERC20) — if unset, public endpoint used for validation only (not for broadcast) */
  ETH_MAINNET_RPC_URL: z.string().url().optional(),
  BSC_MAINNET_RPC_URL: z.string().url().optional(),

  /** Etherscan family API keys (optional; improves rate limits) */
  ETHERSCAN_API_KEY: z.string().optional(),
  BSCSCAN_API_KEY: z.string().optional(),

  /**
   * Custodial deposit addresses (USDT) per network. Must match explorer validation.
   * Set in production; missing value blocks that network.
   */
  CRYPTO_DEPOSIT_USDT_TRC20_ADDRESS: z.string().optional(),
  CRYPTO_DEPOSIT_USDT_ERC20_ADDRESS: z.string().optional(),
  CRYPTO_DEPOSIT_USDT_BEP20_ADDRESS: z.string().optional(),

  /** Fixed USDT fee per crypto deposit and per crypto withdrawal (default 2). */
  CRYPTO_SERVICE_FEE_USDT: z.string().default("2"),

  /**
   * If true, on-chain withdrawals move to SUCCESS with a placeholder txid when no CEX/chain broadcast is configured.
   * Never enable in production unless you process payouts out-of-band.
   */
  CRYPTO_WITHDRAW_CEX_MOCK: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),

  /** Origines autorisées (virgule). Inclure localhost ET 127.0.0.1 si tu ouvres le front des deux façons. */
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000,http://127.0.0.1:3000"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  cached = parsed.data;
  return cached;
}

export function isAdminEmail(email: string): boolean {
  const raw = env().ADMIN_EMAILS;
  if (!raw) return false;
  const set = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return set.has(email.toLowerCase());
}
