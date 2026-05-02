import { Router } from "express";
import { getUsdtFiatReference } from "../services/prices.service.js";

const r = Router();

r.get("/reference/:fiat", async (req, res) => {
  const fiat = req.params.fiat;
  const p = await getUsdtFiatReference(fiat);
  return res.json(p);
});

export default r;
