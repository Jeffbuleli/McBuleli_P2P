import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireVerifiedEmail, type AuthedRequest } from "../middlewares/authMiddleware.js";
import { strictLimiter } from "../middlewares/rateLimit.js";
import { initiateDeposit } from "../services/payments/deposit.service.js";
import { requestWithdrawal } from "../services/payments/withdrawal.service.js";

const r = Router();

const depositBody = z.object({
  phoneNumber: z.string().min(8),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.enum(["CDF", "USD", "EUR"]),
});

const withdrawalBody = z.object({
  phoneNumber: z.string().min(8),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.enum(["CDF", "USD", "EUR"]),
});

/**
 * POST /api/deposits/initiate — Body : phoneNumber, amount, currency (user depuis JWT).
 */
r.post("/deposits/initiate", requireAuth, requireVerifiedEmail, strictLimiter, async (req: AuthedRequest, res) => {
  const parsed = depositBody.safeParse(req.body);
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
      callbackUrlHint: "Configure PawaPay dashboard callback → POST /api/webhooks/pawapay",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg.startsWith("PAWAPAY_DEPOSIT_REJECTED")) return res.status(502).json({ error: msg });
    if (msg === "INVALID_PHONE" || msg === "INVALID_AMOUNT") return res.status(400).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
});

/**
 * POST /api/withdrawals/request
 */
r.post("/withdrawals/request", requireAuth, requireVerifiedEmail, strictLimiter, async (req: AuthedRequest, res) => {
  const parsed = withdrawalBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const out = await requestWithdrawal(
      req.userId!,
      parsed.data.phoneNumber,
      parsed.data.amount,
      parsed.data.currency,
    );
    return res.status(201).json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "INSUFFICIENT_FUNDS") return res.status(400).json({ error: msg });
    if (msg === "DAILY_LIMIT") return res.status(400).json({ error: msg });
    if (msg.startsWith("PAWAPAY_PAYOUT_REJECTED")) return res.status(502).json({ error: msg });
    if (msg === "INVALID_PHONE" || msg === "INVALID_AMOUNT") return res.status(400).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
});

export default r;
