"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Filter, Star } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

type Offer = {
  id: string;
  side: string;
  fiatCurrency: string;
  cryptoAsset: string;
  pricePerUnit: string;
  minFiat: string;
  maxFiat: string;
  user: { username: string; p2pRatingAvg: string | number; completedTrades: number };
};

export default function P2PPage() {
  const { t } = useI18n();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [side, setSide] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [country, setCountry] = useState<"ALL" | "CD">("ALL");

  useEffect(() => {
    api<Offer[]>("/api/p2p/offers").then(setOffers).catch(() => setOffers([]));
  }, []);

  const filtered = useMemo(() => {
    if (!offers) return [];
    return offers.filter((o) => {
      if (side !== "ALL" && o.side !== side) return false;
      if (country === "CD" && o.fiatCurrency !== "CDF") return false;
      return true;
    });
  }, [offers, side, country]);

  if (!offers) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("p2p.title")}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-500">{t("p2p.subtitle")}</p>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
          <Filter className="h-4 w-4" aria-hidden />
          {t("p2p.filterAsset")}
        </div>

        <div className="flex flex-wrap gap-2">
          {(["ALL", "BUY", "SELL"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                side === s
                  ? "bg-brand-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {s === "ALL" ? t("p2p.all") : s === "BUY" ? t("p2p.buy") : t("p2p.sell")}
            </button>
          ))}
        </div>

        <label className="block max-w-xs text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
          {t("p2p.filterCountry")}
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value as "ALL" | "CD")}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="ALL">{t("p2p.all")}</option>
            <option value="CD">{t("p2p.cd")}</option>
          </select>
        </label>

        <p className="text-xs text-slate-500 dark:text-zinc-500">{t("p2p.resultsCount", { n: String(filtered.length) })}</p>
      </Card>

      <ul className="space-y-3">
        {filtered.map((o) => (
          <li key={o.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {o.side === "SELL" ? t("p2p.sell") : t("p2p.buy")} {o.cryptoAsset} · {o.fiatCurrency}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                    <span>@{o.user.username}</span>
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                      {Number(o.user.p2pRatingAvg).toFixed(1)}
                    </span>
                    <span>
                      {o.user.completedTrades} {t("p2p.trades")}
                    </span>
                  </p>
                </div>
                <Badge tone="brand">{o.pricePerUnit}</Badge>
              </div>
              <p className="mt-3 text-xs text-slate-600 dark:text-zinc-500">
                {t("p2p.limits")} {o.minFiat} – {o.maxFiat} {o.fiatCurrency}
              </p>
              <Link
                href={`/app/p2p/trade/new?offer=${o.id}`}
                className="mt-4 inline-flex text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
              >
                {t("p2p.startTrade")}
              </Link>
            </Card>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-slate-500 dark:text-zinc-600">{t("p2p.empty")}</p>
      )}
    </div>
  );
}
