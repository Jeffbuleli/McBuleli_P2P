import rateLimit from "express-rate-limit";

const windowMs = 15 * 60 * 1000;

export const authLimiter = rateLimit({
  windowMs,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
});
