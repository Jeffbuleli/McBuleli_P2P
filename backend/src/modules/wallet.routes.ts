import { Router } from "express";
import { z } from "zod";
import { WalletKind } from "../constants/schemaEnums.js";
import { requireAuth, requireVerifiedEmail, type AuthedRequest } from "../middlewares/authMiddleware.js";
import { getBalances, internalTransfer } from "../services/wallet.service.js";
import { initiateDeposit } from "../services/payments/deposit.service.js";
import { requestWithdrawal } from "../services/payments/withdrawal.service.js";
import { prisma } from "../lib/prisma.js";
import { strictLimiter } from "../middlewares/rateLimit.js";

const r = Router();

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

export default r;
