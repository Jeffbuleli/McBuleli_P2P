import { Redis } from "ioredis";
import { env } from "../config/env.js";

let client: Redis | null = null;

export function getRedis(): Redis | null {
  const url = env().REDIS_URL;
  if (!url) return null;
  if (!client) {
    // Offline queue disabled so commands fail fast; retryStrategy stops reconnect spam when Redis is down.
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      connectTimeout: 10_000,
      enableOfflineQueue: false,
      retryStrategy(times: number) {
        if (times > 8) return null;
        return Math.min(times * 150, 2000);
      },
    });
    // ioredis emits 'error' on connection failure; without a listener Node logs "Unhandled error event".
    client.on("error", (err: Error) => {
      console.warn("[redis]", err.message);
    });
  }
  return client;
}

export async function incrementDailyWithdraw(userId: string, amount: number): Promise<number> {
  const r = getRedis();
  if (!r) return amount;
  const key = `withdraw:day:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const raw = await r.incrbyfloat(key, amount);
  const v = parseFloat(raw);
  // First increment on a new key: total equals this increment
  if (Math.abs(v - amount) < 1e-9) await r.expire(key, 86400 * 2);
  return v;
}

export async function getDailyWithdrawTotal(userId: string): Promise<number> {
  const r = getRedis();
  if (!r) return 0;
  const key = `withdraw:day:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const s = await r.get(key);
  return s ? parseFloat(s) : 0;
}
