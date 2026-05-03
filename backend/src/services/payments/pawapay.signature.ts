import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../../config/env.js";

/**
 * Vérifie une signature HMAC-SHA256 hex du corps brut (header configurable).
 * La prod PawaPay peut utiliser RFC 9421 — à adapter selon la doc « signed callbacks ».
 */
export function verifyPawapayWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
  const secret = env().PAWAPAY_WEBHOOK_SECRET;
  if (!secret) {
    return env().NODE_ENV !== "production";
  }
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signatureHeader.trim(), "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
