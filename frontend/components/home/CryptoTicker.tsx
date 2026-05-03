"use client";

type Row = { pair: string; price: string; chg: string };

/** Bandeau prix statique démo — brancher WebSocket / API plus tard. */
const DEMO: Row[] = [
  { pair: "BTC/USDT", price: "97 420", chg: "+1.2%" },
  { pair: "ETH/USDT", price: "3 542", chg: "-0.4%" },
  { pair: "USDT/CDF", price: "2 865", chg: "+0.1%" },
];

export function CryptoTicker() {
  const doubled = [...DEMO, ...DEMO];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 py-2.5 dark:border-white/10 dark:bg-primary-950">
      <div className="flex w-max animate-ticker gap-10 whitespace-nowrap py-0.5 pr-10">
        {doubled.map((r, i) => (
          <span key={`${r.pair}-${i}`} className="inline-flex items-baseline gap-3 text-sm">
            <span className="font-semibold text-white">{r.pair}</span>
            <span className="font-mono text-zinc-300">{r.price}</span>
            <span className={r.chg.startsWith("-") ? "text-red-400" : "text-emerald-400"}>{r.chg}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
