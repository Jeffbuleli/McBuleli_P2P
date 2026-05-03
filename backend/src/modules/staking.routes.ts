import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireVerifiedEmail, type AuthedRequest } from "../middlewares/authMiddleware.js";
import { strictLimiter } from "../middlewares/rateLimit.js";
import { createStake, listMyStakes, listPools } from "../services/staking.service.js";

const r = Router();

r.get("/pools", requireAuth, async (_req: AuthedRequest, res) => {
  const pools = await listPools();
  return res.json(pools);
});

r.get("/mine", requireAuth, async (req: AuthedRequest, res) => {
  const items = await listMyStakes(req.userId!);
  return res.json(items);
});

const stakeBody = z.object({
  poolId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
});

r.post("/stakes", requireAuth, requireVerifiedEmail, strictLimiter, async (req: AuthedRequest, res) => {
  const parsed = stakeBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const out = await createStake(req.userId!, parsed.data.poolId, parsed.data.amount);
    return res.status(201).json(out);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "INSUFFICIENT_FUNDS") return res.status(400).json({ error: msg });
    if (msg === "POOL_NOT_FOUND") return res.status(404).json({ error: msg });
    if (
      msg === "AMOUNT_TOO_LOW" ||
      msg === "ABOVE_MAX_PER_USER" ||
      msg === "INVALID_AMOUNT" ||
      msg === "STAKE_COOLDOWN"
    ) {
      return res.status(400).json({ error: msg });
    }
    throw e;
  }
});

export default r;
