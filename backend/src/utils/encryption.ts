import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { env } from "../config/env.js";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const SALT = "mcbuleli-v1";

function keyBuf(): Buffer {
  return scryptSync(env().ENCRYPTION_KEY, SALT, 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, keyBuf(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(encB64: string): string {
  const buf = Buffer.from(encB64, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const enc = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, keyBuf(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
