import { Router } from "express";
import { z } from "zod";
import {
  registerUser,
  loginUser,
  refreshSession,
  verifyEmailToken,
  generateTwoFactorSetup,
  enableTwoFactor,
  disableTwoFactor,
} from "../services/auth.service.js";
import { requireAuth, type AuthedRequest } from "../middlewares/authMiddleware.js";
import { authLimiter, strictLimiter } from "../middlewares/rateLimit.js";

const r = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  fullName: z.string().min(2),
  username: z.string().min(3).regex(/^[a-z0-9_]+$/i),
  phone: z.string().optional(),
  country: z.string().length(2).optional(),
});

r.post("/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const user = await registerUser(parsed.data);
    return res.status(201).json({
      id: user.id,
      email: user.email,
      message: "Registered. Verify email to unlock trading.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg.includes("Unique")) return res.status(409).json({ error: "DUPLICATE" });
    return res.status(400).json({ error: msg });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  twoFactorCode: z.string().optional(),
});

r.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const ip = req.ip ?? req.socket.remoteAddress;
    const ua = req.headers["user-agent"];
    const result = await loginUser(
      parsed.data.email,
      parsed.data.password,
      parsed.data.twoFactorCode,
      ip,
      typeof ua === "string" ? ua : undefined,
    );
    return res.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "2FA_REQUIRED") return res.status(401).json({ error: "2FA_REQUIRED" });
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }
});

r.post("/refresh", authLimiter, async (req, res) => {
  const token = req.body?.refreshToken as string | undefined;
  if (!token) return res.status(400).json({ error: "MISSING_REFRESH" });
  try {
    const out = await refreshSession(token);
    return res.json(out);
  } catch {
    return res.status(401).json({ error: "INVALID_REFRESH" });
  }
});

r.post("/verify-email", async (req, res) => {
  const schema = z.object({ userId: z.string().uuid(), token: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    await verifyEmailToken(parsed.data.userId, parsed.data.token);
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ error: "INVALID_TOKEN" });
  }
});

r.post("/2fa/setup", requireAuth, strictLimiter, async (req: AuthedRequest, res) => {
  try {
    const out = await generateTwoFactorSetup(req.userId!);
    return res.json(out);
  } catch (e: unknown) {
    return res.status(400).json({ error: e instanceof Error ? e.message : "ERROR" });
  }
});

r.post("/2fa/enable", requireAuth, strictLimiter, async (req: AuthedRequest, res) => {
  const schema = z.object({ secret: z.string(), code: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    await enableTwoFactor(req.userId!, parsed.data.secret, parsed.data.code);
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ error: "INVALID_2FA" });
  }
});

r.post("/2fa/disable", requireAuth, strictLimiter, async (req: AuthedRequest, res) => {
  const schema = z.object({ password: z.string(), code: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    await disableTwoFactor(req.userId!, parsed.data.password, parsed.data.code);
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ error: "FAILED" });
  }
});

export default r;
