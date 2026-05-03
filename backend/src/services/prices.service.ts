const BINANCE_SPOT = "https://api.binance.com";

/** Public reference price (Binance) — no execution, read-only. */
export async function getUsdtFiatReference(fiat: string): Promise<{ symbol: string; price: string }> {
  const f = fiat.toUpperCase();
  if (f === "USD") {
    return { symbol: "USDTUSD", price: "1" };
  }
  const symbol = `USDT${f}`;
  const url = `${BINANCE_SPOT}/api/v3/ticker/price?symbol=${symbol}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { symbol, price: f === "CDF" ? "2800" : "0" };
    }
    const j = (await res.json()) as { price: string };
    return { symbol, price: j.price };
  } catch {
    return { symbol, price: f === "CDF" ? "2800" : "0" };
  }
}

export type HomeTickerRow = {
  pair: string;
  price: string;
  chg: string;
};

function formatSpotPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000) {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));
  }
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
}

function formatPct(p: string | undefined): string {
  if (p == null || p === "") return "—";
  const x = parseFloat(p);
  if (!Number.isFinite(x)) return "—";
  const s = (x >= 0 ? "+" : "") + x.toFixed(2) + "%";
  return s;
}

/**
 * Live spot rows for the marketing ticker — Binance public REST only (no API key).
 * @see https://binance-docs.github.io/apidocs/spot/en/#24hr-ticker-price-change-statistics
 */
export async function getHomeCryptoTicker(): Promise<HomeTickerRow[]> {
  const spotPairs = [
    { pair: "BTC/USDT", symbol: "BTCUSDT" },
    { pair: "ETH/USDT", symbol: "ETHUSDT" },
  ];

  const settled = await Promise.allSettled(
    spotPairs.map(async ({ pair, symbol }) => {
      const url = `${BINANCE_SPOT}/api/v3/ticker/24hr?symbol=${symbol}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const j = (await res.json()) as { lastPrice?: string; priceChangePercent?: string };
      const last = parseFloat(j.lastPrice ?? "");
      return {
        pair,
        price: formatSpotPrice(last),
        chg: formatPct(j.priceChangePercent),
      };
    }),
  );

  const rows: HomeTickerRow[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") rows.push(r.value);
  }

  try {
    const cdf = await getUsdtFiatReference("CDF");
    const px = parseFloat(cdf.price);
    rows.push({
      pair: "USDT/CDF",
      price: Number.isFinite(px) ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(px) : cdf.price,
      chg: "—",
    });
  } catch {
    rows.push({ pair: "USDT/CDF", price: "—", chg: "—" });
  }

  if (rows.length === 0) {
    throw new Error("BINANCE_TICKER_UNAVAILABLE");
  }

  return rows;
}
