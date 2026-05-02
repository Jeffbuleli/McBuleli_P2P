import express, { type Router } from "express";
import { handleDepositWebhook, verifyPawapaySignature } from "../services/pawapay.service.js";
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
    const sig = req.headers["x-pawapay-signature"] as string | undefined;
    if (env().NODE_ENV === "production" && !verifyPawapaySignature(raw, sig)) {
      return res.status(401).json({ error: "BAD_SIGNATURE" });
    }
    const body = req.body as {
      externalRef: string;
      status: "SUCCESS" | "FAILED";
      amount?: string;
      currency?: string;
    };
    try {
      await handleDepositWebhook(body);
      return res.json({ received: true });
    } catch {
      return res.status(500).json({ error: "WEBHOOK_ERROR" });
    }
  });

  return r;
}
