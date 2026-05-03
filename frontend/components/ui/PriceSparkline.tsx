"use client";

import { useMemo, useState } from "react";

const FILTERS = ["1H", "24H", "7D"] as const;

/** SVG sparkline léger — pas de lib chart (perf / low bandwidth). */
export function PriceSparkline({
  label,
  price,
  changePct,
}: {
  label: string;
  price: string;
  changePct: number;
}) {
  const [range, setRange] = useState<(typeof FILTERS)[number]>("24H");

  const points = useMemo(() => {
    const n = 24;
    const seed = range === "1H" ? 3 : range === "7D" ? 9 : 5;
    const amp = Math.abs(changePct) * 0.8 + 1;
    return Array.from({ length: n }, (_, i) => {
      const wobble = Math.sin((i + seed) * 0.7) * amp + (i / n) * changePct * 0.15;
      return 50 - wobble * 3;
    });
  }, [changePct, range]);

  const pathD = useMemo(() => {
    if (points.length === 0) return "";
    const w = 200;
    const h = 48;
    const step = w / (points.length - 1);
    return points
      .map((y, i) => `${i === 0 ? "M" : "L"} ${i * step} ${(y / 100) * h}`)
      .join(" ");
  }, [points]);

  const positive = changePct >= 0;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-card dark:border-white/10 dark:bg-surface-secondary/90">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-500">
            {label}
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {price}
          </p>
          <p className={`mt-0.5 text-xs font-medium ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {positive ? "+" : ""}
            {changePct.toFixed(2)}%
          </p>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-0.5 dark:bg-zinc-900">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setRange(f)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition ${
                range === f
                  ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-slate-500 hover:text-slate-800 dark:text-zinc-500 dark:hover:text-zinc-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 200 48" className="mt-3 h-12 w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${pathD} L 200 48 L 0 48 Z`}
          fill="url(#spark-fill)"
          className="dark:opacity-90"
        />
        <path
          d={pathD}
          fill="none"
          stroke="rgb(16, 185, 129)"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
