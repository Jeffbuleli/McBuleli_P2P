import { Router } from "express";
import { getHomeCryptoTicker, getUsdtFiatReference } from "../services/prices.service.js";

const r = Router();

/** Binance public 24h ticker + USDT/CDF — pas de clé API requise. */
r.get("/ticker", async (_req, res) => {
  try {
    const rows = await getHomeCryptoTicker();
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30");
    return res.json(rows);
  } catch {
    return res.status(503).json({ error: "UNAVAILABLE" });
  }
});

r.get("/reference/:fiat", async (req, res) => {
  const fiat = req.params.fiat;
  const p = await getUsdtFiatReference(fiat);
  return res.json(p);
});

export default r;
