import express, { type Router } from "express";
import { verifyPawapayWebhookSignature } from "../services/payments/pawapay.signature.js";
import { processPawapayWebhookPayload } from "../services/payments/webhook.service.js";
import { env } from "../config/env.js";

type ReqWithRaw = express.Request & { rawBody?: string };

export function createWebhookRouter(): Router {
  const r = express.Router();
  r.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as ReqWithRaw).rawBody = buf.toString("utf8");
      },
    }),
  );

  r.post("/pawapay", async (req, res) => {
    const raw = (req as ReqWithRaw).rawBody ?? "";
    const sig =
      (req.headers["x-pawapay-signature"] as string | undefined) ??
      (req.headers["x-signature"] as string | undefined);

    const signatureOk = verifyPawapayWebhookSignature(raw, sig);
    if (env().NODE_ENV === "production" && !signatureOk) {
      console.warn("[pawapay] webhook rejected: bad or missing signature");
      return res.status(401).json({ error: "BAD_SIGNATURE" });
    }

    try {
      const result = await processPawapayWebhookPayload(req.body);
      return res.json({ ok: true, ...result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "WEBHOOK_ERROR";
      console.error("[pawapay] webhook handler", e);
      return res.status(msg === "INVALID_BODY" ? 400 : 500).json({ error: msg });
    }
  });

  return r;
}
