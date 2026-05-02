import { authenticator } from "otplib";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma.js";
import { getRedis } from "../lib/redis.js";
import { encryptSecret, decryptSecret } from "../utils/encryption.js";
import { hashPassword, verifyPassword, sha256Hex } from "../utils/hash.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { newReference } from "../utils/refs.js";
import { env } from "../config/env.js";
import type { User } from "@prisma/client";

const REFRESH_DAYS = 7;

function refreshExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_DAYS);
  return d;
}

export async function registerUser(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  country?: string;
  username: string;
}): Promise<User> {
  const email = input.email.toLowerCase().trim();
  const username = input.username.toLowerCase().trim();
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone,
      country: input.country ?? "CD",
    },
  });
  const token = uuidv4();
  const r = getRedis();
  if (r) {
    await r.setex(`emailverify:${user.id}`, 86400, sha256Hex(token));
  }
  // In production, send email with link `${APP_URL}/verify-email?token=...&uid=...`
  if (env().NODE_ENV === "development") {
    console.info(`[dev] Email verify token for ${email}: ${token}`);
  }
  await prisma.walletAccount.createMany({
    data: [
      { userId: user.id, kind: "FIAT", currencyCode: "CDF" },
      { userId: user.id, kind: "FIAT", currencyCode: "USD" },
      { userId: user.id, kind: "CRYPTO", currencyCode: "USDT" },
    ],
    skipDuplicates: true,
  });
  return user;
}

export async function verifyEmailToken(userId: string, token: string): Promise<void> {
  const r = getRedis();
  if (!r) {
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    return;
  }
  const key = `emailverify:${userId}`;
  const expected = await r.get(key);
  if (!expected || expected !== sha256Hex(token)) throw new Error("INVALID_TOKEN");
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await r.del(key);
}

export async function loginUser(
  email: string,
  password: string,
  twoFactorCode: string | undefined,
  ip: string | undefined,
  userAgent: string | undefined,
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: Pick<User, "id" | "email" | "fullName" | "username" | "twoFactorEnabled" | "kycStatus">;
}> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || user.isBlacklisted) throw new Error("INVALID_CREDENTIALS");
  if (user.isFrozen) throw new Error("ACCOUNT_FROZEN");
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error("INVALID_CREDENTIALS");
  if (user.twoFactorEnabled) {
    if (!user.twoFactorSecretEnc) throw new Error("2FA_MISCONFIGURED");
    const secret = decryptSecret(user.twoFactorSecretEnc);
    if (!twoFactorCode || !authenticator.verify({ token: twoFactorCode, secret })) {
      throw new Error("2FA_REQUIRED");
    }
  }
  const jti = uuidv4();
  const refreshToken = signRefreshToken({ sub: user.id, jti });
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const tokenHash = sha256Hex(refreshToken);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: refreshExpiry(),
    },
  });
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: jti,
      ipAddress: ip,
      userAgent: userAgent ?? null,
      deviceLabel: null,
      expiresAt: refreshExpiry(),
    },
  });
  if (ip) {
    const fp = sha256Hex(`${user.id}:${userAgent ?? ""}`);
    await prisma.device.upsert({
      where: { userId_fingerprint: { userId: user.id, fingerprint: fp } },
      create: { userId: user.id, fingerprint: fp, lastIp: ip, lastSeenAt: new Date() },
      update: { lastIp: ip, lastSeenAt: new Date() },
    });
  }
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      username: user.username,
      twoFactorEnabled: user.twoFactorEnabled,
      kycStatus: user.kycStatus,
    },
  };
}

export async function refreshSession(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = sha256Hex(refreshToken);
  const row = await prisma.refreshToken.findFirst({
    where: { userId: payload.sub, tokenHash, expiresAt: { gt: new Date() } },
  });
  if (!row) throw new Error("INVALID_REFRESH");
  await prisma.refreshToken.delete({ where: { id: row.id } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
  const jti = uuidv4();
  const newRefresh = signRefreshToken({ sub: user.id, jti });
  const newHash = sha256Hex(newRefresh);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: newHash, expiresAt: refreshExpiry() },
  });
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  return { accessToken, refreshToken: newRefresh };
}

export async function generateTwoFactorSetup(userId: string): Promise<{
  secret: string;
  qrDataUrl: string;
}> {
  const secret = authenticator.generateSecret();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const otpauth = authenticator.keyuri(user.email, "McBuleli P2P", secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);
  return { secret, qrDataUrl };
}

export async function enableTwoFactor(userId: string, secret: string, code: string): Promise<void> {
  if (!authenticator.verify({ token: code, secret })) throw new Error("INVALID_2FA");
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true, twoFactorSecretEnc: encryptSecret(secret) },
  });
}

export async function disableTwoFactor(userId: string, password: string, code: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(password, user.passwordHash))) throw new Error("INVALID_PASSWORD");
  if (!user.twoFactorSecretEnc) throw new Error("2FA_NOT_ENABLED");
  const sec = decryptSecret(user.twoFactorSecretEnc);
  if (!authenticator.verify({ token: code, secret: sec })) throw new Error("INVALID_2FA");
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecretEnc: null },
  });
}
