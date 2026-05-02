import bcrypt from "bcrypt";
import crypto from "crypto";
import { env } from "../config/env.js";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env().BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
