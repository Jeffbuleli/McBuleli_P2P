import { env } from "../config/env.js";

/** Public reference price (Binance) — no execution, read-only. */
export async function getUsdtFiatReference(fiat: string): Promise<{ symbol: string; price: string }> {
  const f = fiat.toUpperCase();
  if (f === "USD") {
    return { symbol: "USDTUSD", price: "1" };
  }
  const symbol = `USDT${f}`;
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { symbol, price: f === "CDF" ? "2800" : "0" };
    }
    const j = (await res.json()) as { price: string };
    return { symbol, price: j.price };
  } catch {
    void env().BINANCE_API_KEY;
    return { symbol, price: f === "CDF" ? "2800" : "0" };
  }
}
