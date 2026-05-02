import { Router } from "express";
import { z } from "zod";
import { P2POfferSide } from "../constants/schemaEnums.js";
import { requireAuth, requireVerifiedEmail, type AuthedRequest } from "../middlewares/authMiddleware.js";
import {
  createOffer,
  listOffers,
  startTrade,
  markPaid,
  confirmRelease,
  cancelTrade,
  openDispute,
  addTradeMessage,
  listTradeMessages,
  submitRating,
} from "../services/p2p.service.js";
import { prisma } from "../lib/prisma.js";
import { strictLimiter } from "../middlewares/rateLimit.js";

const r = Router();

r.get("/offers", async (req, res) => {
  const side = req.query.side as P2POfferSide | undefined;
  const fiat = req.query.fiat as string | undefined;
  const crypto = req.query.crypto as string | undefined;
  const rows = await listOffers({ side, fiat, crypto });
  return res.json(rows);
});

const offerSchema = z.object({
  side: z.nativeEnum(P2POfferSide),
  cryptoAsset: z.enum(["USDT", "BTC"]),
  fiatCurrency: z.enum(["USD", "CDF", "EUR"]),
  pricePerUnit: z.string(),
  minFiat: z.string(),
  maxFiat: z.string(),
  paymentMethods: z.array(z.any()).default([]),
});

r.post("/offers", requireAuth, requireVerifiedEmail, async (req: AuthedRequest, res) => {
  const parsed = offerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const o = await createOffer(req.userId!, parsed.data);
  return res.status(201).json(o);
});

const startSchema = z.object({
  offerId: z.string().uuid(),
  fiatAmount: z.string(),
});

r.post("/trades", requireAuth, requireVerifiedEmail, strictLimiter, async (req: AuthedRequest, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const t = await startTrade(parsed.data.offerId, req.userId!, parsed.data.fiatAmount);
    return res.status(201).json(t);
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

r.get("/trades/:id", requireAuth, async (req: AuthedRequest, res) => {
  const t = await prisma.p2PTrade.findFirst({
    where: {
      id: req.params.id,
      OR: [{ buyerId: req.userId! }, { sellerId: req.userId! }],
    },
    include: { offer: true, dispute: true },
  });
  if (!t) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json(t);
});

r.post("/trades/:id/paid", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const t = await markPaid(req.params.id, req.userId!);
    return res.json(t);
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

r.post("/trades/:id/confirm", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const t = await confirmRelease(req.params.id, req.userId!);
    return res.json(t);
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

r.post("/trades/:id/cancel", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const t = await cancelTrade(req.params.id, req.userId!);
    return res.json(t);
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

r.post("/trades/:id/dispute", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({ reason: z.string().min(5) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const t = await openDispute(req.params.id, req.userId!, parsed.data.reason);
    return res.json(t);
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

r.get("/trades/:id/messages", requireAuth, async (req: AuthedRequest, res) => {
  const trade = await prisma.p2PTrade.findFirst({
    where: {
      id: req.params.id,
      OR: [{ buyerId: req.userId! }, { sellerId: req.userId! }],
    },
  });
  if (!trade) return res.status(404).json({ error: "NOT_FOUND" });
  const msgs = await listTradeMessages(trade.id);
  return res.json(msgs);
});

r.post("/trades/:id/messages", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({ body: z.string().min(1).max(4000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const trade = await prisma.p2PTrade.findFirst({
    where: {
      id: req.params.id,
      OR: [{ buyerId: req.userId! }, { sellerId: req.userId! }],
    },
  });
  if (!trade) return res.status(404).json({ error: "NOT_FOUND" });
  const m = await addTradeMessage(trade.id, req.userId!, parsed.data.body);
  return res.status(201).json(m);
});

r.post("/trades/:id/rating", requireAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    score: z.number().int().min(1).max(5),
    comment: z.string().max(500).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    await submitRating(req.params.id, req.userId!, parsed.data.score, parsed.data.comment);
    return res.json({ ok: true });
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

export default r;
