import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessPayload {
  sub: string;
  email: string;
  typ: "access";
}

export interface RefreshPayload {
  sub: string;
  typ: "refresh";
  jti: string;
}

export function signAccessToken(payload: Omit<AccessPayload, "typ">): string {
  return jwt.sign({ ...payload, typ: "access" }, env().JWT_ACCESS_SECRET, {
    expiresIn: env().JWT_ACCESS_EXPIRES as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: Omit<RefreshPayload, "typ">): string {
  return jwt.sign({ ...payload, typ: "refresh" }, env().JWT_REFRESH_SECRET, {
    expiresIn: env().JWT_REFRESH_EXPIRES as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  const d = jwt.verify(token, env().JWT_ACCESS_SECRET) as AccessPayload;
  if (d.typ !== "access") throw new Error("Invalid token type");
  return d;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const d = jwt.verify(token, env().JWT_REFRESH_SECRET) as RefreshPayload;
  if (d.typ !== "refresh") throw new Error("Invalid token type");
  return d;
}
