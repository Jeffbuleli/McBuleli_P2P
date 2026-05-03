import { Router } from "express";
import { z } from "zod";
import QRCode from "qrcode";
import { env } from "../config/env.js";
import { WalletKind } from "../constants/schemaEnums.js";
import { requireAuth, requireVerifiedEmail, type AuthedRequest } from "../middlewares/authMiddleware.js";
import { getBalances, internalTransfer } from "../services/wallet.service.js";
import { initiateDeposit } from "../services/payments/deposit.service.js";
import { requestWithdrawal } from "../services/payments/withdrawal.service.js";
import { prisma } from "../lib/prisma.js";
import { strictLimiter } from "../middlewares/rateLimit.js";
import {
  createDepositIntent,
  getDepositIntent,
  markDepositSent,
  refreshDepositTx,
  submitDepositTxid,
} from "../services/crypto/crypto-deposit.service.js";
import { requestCryptoWithdrawal } from "../services/crypto/crypto-withdrawal.service.js";
import { CRYPTO_MIN_NET_USDT, cryptoServiceFeeUsdt } from "../services/crypto/crypto-fees.js";

const r = Router();

function routeParamString(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

r.get("/balances", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await getBalances(req.userId!);
  return res.json(rows);
});

r.get("/transactions", requireAuth, async (req: AuthedRequest, res) => {
  const items = await prisma.transaction.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return res.json(items);
});

const transferSchema = z.object({
  to: z.string().min(3),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  currencyCode: z.string().min(2).max(8),
  kind: z.enum(["CRYPTO", "FIAT"]),
});

r.post("/transfer", requireAuth, requireVerifiedEmail, strictLimiter, async (req: AuthedRequest, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await internalTransfer(
      req.userId!,
      parsed.data.to,
      parsed.data.amount,
      parsed.data.currencyCode,
      parsed.data.kind as WalletKind,
    );
    return res.status(201).json(row);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "INSUFFICIENT_FUNDS") return res.status(400).json({ error: msg });
    if (msg === "USER_NOT_FOUND") return res.status(404).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
});

const depositSchema = z.object({
  phoneNumber: z.string().min(8),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.enum(["CDF", "USD", "EUR"]),
});

r.post("/fiat/deposit", requireAuth, requireVerifiedEmail, async (req: AuthedRequest, res) => {
  const parsed = depositSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const out = await initiateDeposit(
      req.userId!,
      parsed.data.phoneNumber,
      parsed.data.amount,
      parsed.data.currency,
    );
    return res.status(201).json({
      ...out,
      nextStep: "Approve the Mobile Money prompt; balance updates after PawaPay callback.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg.startsWith("PAWAPAY_DEPOSIT_REJECTED")) return res.status(502).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
});

const withdrawSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.enum(["CDF", "USD", "EUR"]),
  msisdn: z.string().min(8),
});

r.post("/fiat/withdraw", requireAuth, requireVerifiedEmail, strictLimiter, async (req: AuthedRequest, res) => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const out = await requestWithdrawal(
      req.userId!,
      parsed.data.msisdn,
      parsed.data.amount,
      parsed.data.currency,
    );
    return res.status(201).json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return res.status(400).json({ error: msg });
  }
});

const chainNetworkZ = z.enum(["TRC20", "ERC20", "BEP20"]);

r.get("/crypto/supported", requireAuth, (req: AuthedRequest, res) => {
  const e = env();
  const fee = cryptoServiceFeeUsdt();
  const minNet = CRYPTO_MIN_NET_USDT;
  return res.json({
    asset: "USDT" as const,
    minDeposit: minNet.toString(),
    minWithdraw: minNet.toString(),
    serviceFeeUsdt: fee.toString(),
    minSendOnChainDeposit: minNet.add(fee).toString(),
    networks: {
      TRC20: {
        enabled: Boolean(e.CRYPTO_DEPOSIT_USDT_TRC20_ADDRESS?.trim()),
        color: "emerald" as const,
      },
      ERC20: {
        enabled: Boolean(e.CRYPTO_DEPOSIT_USDT_ERC20_ADDRESS?.trim()),
        color: "blue" as const,
      },
      BEP20: {
        enabled: Boolean(e.CRYPTO_DEPOSIT_USDT_BEP20_ADDRESS?.trim()),
        color: "amber" as const,
      },
    },
  });
});

const depositIntentBody = z.object({
  asset: z.enum(["USDT"]),
  network: chainNetworkZ,
  acceptedRisk: z.literal(true),
});

r.post(
  "/crypto/deposit/intent",
  requireAuth,
  requireVerifiedEmail,
  strictLimiter,
  async (req: AuthedRequest, res) => {
    const parsed = depositIntentBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const out = await createDepositIntent({
        userId: req.userId!,
        asset: parsed.data.asset,
        network: parsed.data.network,
        acceptedRisk: parsed.data.acceptedRisk,
      });
      return res.status(201).json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "ERROR";
      if (msg === "RISK_NOT_ACCEPTED") return res.status(400).json({ error: msg });
      if (msg === "ASSET_NOT_SUPPORTED") return res.status(400).json({ error: msg });
      if (msg === "CRYPTO_DEPOSIT_NOT_CONFIGURED") return res.status(503).json({ error: msg });
      return res.status(400).json({ error: msg });
    }
  },
);

r.get("/crypto/deposit/:intentId", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const intent = await getDepositIntent(req.userId!, routeParamString(req.params.intentId));
    return res.json(intent);
  } catch {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
});

r.get("/crypto/deposit/:intentId/qr.png", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const intent = await getDepositIntent(req.userId!, routeParamString(req.params.intentId));
    const png = await QRCode.toBuffer(intent.platformAddress, {
      type: "png",
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.send(png);
  } catch {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
});

r.post(
  "/crypto/deposit/:intentId/sent",
  requireAuth,
  requireVerifiedEmail,
  strictLimiter,
  async (req: AuthedRequest, res) => {
    try {
      const out = await markDepositSent(req.userId!, routeParamString(req.params.intentId));
      return res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "ERROR";
      if (msg === "INTENT_NOT_FOUND") return res.status(404).json({ error: msg });
      return res.status(400).json({ error: msg });
    }
  },
);

r.post(
  "/crypto/deposit/:intentId/txid",
  requireAuth,
  requireVerifiedEmail,
  strictLimiter,
  async (req: AuthedRequest, res) => {
    const body = z.object({ txid: z.string().min(8).max(128) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.flatten() });
    try {
      const out = await submitDepositTxid(req.userId!, routeParamString(req.params.intentId), body.data.txid);
      return res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "ERROR";
      if (msg === "TXID_REUSED") return res.status(409).json({ error: msg });
      if (msg === "INTENT_NOT_FOUND") return res.status(404).json({ error: msg });
      if (msg === "INTENT_FAILED") return res.status(400).json({ error: msg });
      if (msg === "PLATFORM_FEES_TREASURY_NOT_CONFIGURED") return res.status(503).json({ error: msg });
      return res.status(400).json({ error: msg });
    }
  },
);

r.post(
  "/crypto/deposit/:intentId/refresh",
  requireAuth,
  requireVerifiedEmail,
  strictLimiter,
  async (req: AuthedRequest, res) => {
    try {
      const out = await refreshDepositTx(req.userId!, routeParamString(req.params.intentId));
      return res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "ERROR";
      if (msg === "TXID_MISSING") return res.status(400).json({ error: msg });
      if (msg === "INTENT_NOT_FOUND") return res.status(404).json({ error: msg });
      if (msg === "PLATFORM_FEES_TREASURY_NOT_CONFIGURED") return res.status(503).json({ error: msg });
      return res.status(400).json({ error: msg });
    }
  },
);

const cryptoWithdrawBody = z.object({
  network: chainNetworkZ,
  toAddress: z.string().min(10).max(128),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
});

r.post(
  "/crypto/withdraw",
  requireAuth,
  requireVerifiedEmail,
  strictLimiter,
  async (req: AuthedRequest, res) => {
    const parsed = cryptoWithdrawBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const row = await requestCryptoWithdrawal({
        userId: req.userId!,
        network: parsed.data.network,
        toAddress: parsed.data.toAddress,
        amountStr: parsed.data.amount,
      });
      return res.status(201).json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "ERROR";
      if (msg === "INSUFFICIENT_FUNDS") return res.status(400).json({ error: msg });
      if (msg === "INVALID_ADDRESS") return res.status(400).json({ error: msg });
      if (msg === "BELOW_MIN_WITHDRAW") return res.status(400).json({ error: msg });
      if (msg === "PLATFORM_FEES_TREASURY_NOT_CONFIGURED") return res.status(503).json({ error: msg });
      return res.status(400).json({ error: msg });
    }
  },
);

/** Dev helper: whether custodial deposit addresses are set (no secrets). */
r.get("/crypto/env-check", requireAuth, (_req, res) => {
  const e = env();
  return res.json({
    depositAddressesConfigured: {
      TRC20: Boolean(e.CRYPTO_DEPOSIT_USDT_TRC20_ADDRESS?.trim()),
      ERC20: Boolean(e.CRYPTO_DEPOSIT_USDT_ERC20_ADDRESS?.trim()),
      BEP20: Boolean(e.CRYPTO_DEPOSIT_USDT_BEP20_ADDRESS?.trim()),
    },
    withdrawMock: Boolean(e.CRYPTO_WITHDRAW_CEX_MOCK),
  });
});

export default r;
