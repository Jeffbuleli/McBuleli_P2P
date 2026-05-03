"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  ChevronDown,
  Filter,
  Lock,
  Shield,
  Star,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

type OfferUser = {
  username: string;
  p2pRatingAvg: string | number;
  completedTrades: number;
  p2pTradesTotal?: number;
};

type Offer = {
  id: string;
  side: string;
  fiatCurrency: string;
  cryptoAsset: string;
  pricePerUnit: string;
  minFiat: string;
  maxFiat: string;
  paymentMethods?: unknown;
  user: OfferUser;
};

function initials(username: string): string {
  const clean = username.replace(/^@/, "").trim();
  if (!clean) return "?";
  return clean.slice(0, 2).toUpperCase();
}

function paymentLabels(methods: unknown): string[] {
  if (methods == null) return [];
  if (Array.isArray(methods)) {
    return methods.map((m) => {
      if (typeof m === "string") return m.replace(/_/g, " ").trim() || m;
      if (m && typeof m === "object") {
        const o = m as Record<string, unknown>;
        if (typeof o.label === "string") return o.label;
        if (typeof o.type === "string") return o.type.replace(/_/g, " ");
      }
      try {
        return JSON.stringify(m).slice(0, 28);
      } catch {
        return "—";
      }
    });
  }
  if (typeof methods === "object") {
    return Object.entries(methods as Record<string, unknown>).map(
      ([k, v]) => `${k}: ${String(v)}`.slice(0, 40),
    );
  }
  return [];
}

function successRatePercent(u: OfferUser): number | null {
  const total = u.p2pTradesTotal ?? 0;
  if (total <= 0) return null;
  return Math.min(100, Math.round((u.completedTrades / total) * 100));
}

function formatPriceDisplay(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function P2PPage() {
  const { t, locale } = useI18n();
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
      <div className="space-y-5 pb-4">
        <div className="space-y-2">
          <Skeleton className="mx-auto h-7 w-56 rounded-xl" />
          <Skeleton className="mx-auto h-4 w-full max-w-sm rounded-md" />
        </div>
        <Skeleton className="h-36 w-full rounded-3xl" />
        <Skeleton className="h-52 w-full rounded-3xl" />
        <Skeleton className="h-52 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* Hero */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50 to-emerald-50/50 px-4 py-6 shadow-card-lg dark:border-white/10 dark:from-primary-950/90 dark:via-surface-secondary dark:to-earth-950/30 dark:shadow-card-lg">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-brand-400/15 blur-3xl dark:bg-brand-500/15"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-10 -left-6 h-32 w-32 rounded-full bg-primary-400/15 blur-2xl dark:bg-primary-600/20"
        />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            <Shield className="h-3.5 w-3.5" aria-hidden />
            {t("p2p.escrowBadge")}
          </div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t("p2p.title")}
          </h1>
          <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            {t("p2p.subtitle")}
          </p>
        </div>
      </section>

      {/* Filters */}
      <Card className="mb-5 overflow-hidden border-slate-200/90 bg-white/95 p-0 dark:border-white/[0.08] dark:bg-surface-secondary/90">
        <div className="border-b border-slate-200/80 px-4 py-3 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
            <Filter className="h-3.5 w-3.5 text-brand-600 dark:text-brand-500" aria-hidden />
            {t("p2p.filterAsset")}
          </div>
          <div
            className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-slate-100/90 p-1 dark:bg-black/40"
            role="tablist"
            aria-label={t("p2p.filterAsset")}
          >
            {(["ALL", "BUY", "SELL"] as const).map((s) => {
              const active = side === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSide(s)}
                  className={`relative min-h-10 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? "bg-white text-slate-900 shadow-md dark:bg-zinc-800 dark:text-white dark:shadow-black/40"
                      : "text-slate-600 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-300"
                  }`}
                >
                  {s === "ALL" ? t("p2p.all") : s === "BUY" ? t("p2p.buy") : t("p2p.sell")}
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-4 py-3">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
            {t("p2p.filterCountry")}
          </label>
          <div className="relative mt-2">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value as "ALL" | "CD")}
              className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-4 pr-10 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="ALL">{t("p2p.all")}</option>
              <option value="CD">{t("p2p.cd")}</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
              aria-hidden
            />
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-500 dark:text-zinc-500">
            {t("p2p.resultsCount", { n: String(filtered.length) })}
          </p>
        </div>
      </Card>

      {/* List */}
      <ul className="flex flex-col gap-4">
        {filtered.map((o) => {
          const isSell = o.side === "SELL";
          const accent = isSell
            ? "from-brand-500/90 to-emerald-600/80"
            : "from-sky-500/90 to-primary-600/80";
          const borderAccent = isSell ? "border-brand-500/40" : "border-sky-500/40";
          const chips = paymentLabels(o.paymentMethods).slice(0, 4);
          const extraPm = Math.max(0, paymentLabels(o.paymentMethods).length - chips.length);
          const rate = successRatePercent(o.user);

          return (
            <li key={o.id}>
              <article
                className={`group relative overflow-hidden rounded-3xl border bg-white/95 shadow-card transition hover:shadow-card-lg dark:border-white/[0.08] dark:bg-surface-secondary/95 ${borderAccent}`}
              >
                <div className={`h-1 w-full bg-gradient-to-r ${accent}`} aria-hidden />

                <div className="p-4 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                            isSell
                              ? "bg-brand-500/15 text-brand-700 dark:text-brand-400"
                              : "bg-sky-500/15 text-sky-800 dark:text-sky-400"
                          }`}
                        >
                          {isSell ? t("p2p.sell") : t("p2p.buy")}
                        </span>
                        <span className="text-xs font-medium text-slate-500 dark:text-zinc-500">
                          {o.cryptoAsset}/{o.fiatCurrency}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-slate-600 dark:text-zinc-400">
                        {isSell ? t("p2p.blurbSell") : t("p2p.blurbBuy")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        {t("p2p.unitPrice")}
                      </p>
                      <p className="font-mono text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
                        {formatPriceDisplay(o.pricePerUnit)}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-500">
                        {o.fiatCurrency} / {o.cryptoAsset}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-black/25">
                    <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" aria-hidden />
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                        {t("p2p.limits")}
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-slate-800 dark:text-zinc-200">
                        {o.minFiat} – {o.maxFiat}{" "}
                        <span className="font-normal text-slate-500 dark:text-zinc-500">{o.fiatCurrency}</span>
                      </p>
                    </div>
                  </div>

                  {chips.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-600">
                        {t("p2p.payMethods")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {chips.map((label, i) => (
                          <span
                            key={`${o.id}-pm-${i}`}
                            className="inline-flex max-w-full truncate rounded-lg border border-slate-200/90 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300"
                          >
                            {label}
                          </span>
                        ))}
                        {extraPm > 0 && (
                          <span className="inline-flex rounded-lg border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-500 dark:border-zinc-600 dark:text-zinc-500">
                            {t("p2p.moreMethods", { n: String(extraPm) })}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="my-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />

                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 text-sm font-bold text-slate-700 shadow-inner dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-100"
                      aria-hidden
                    >
                      {initials(o.user.username)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">
                        @{o.user.username.replace(/^@/, "")}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                          {Number(o.user.p2pRatingAvg || 0).toFixed(1)}
                        </span>
                        <span>
                          {o.user.completedTrades} {t("p2p.trades")}
                        </span>
                        {rate != null ? (
                          <span className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400">
                            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                            {t("p2p.successRate", { n: String(rate) })}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-600">{t("p2p.newMerchant")}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/app/p2p/trade/new?offer=${o.id}`}
                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-sm font-semibold text-white shadow-lg shadow-brand-900/25 transition hover:from-brand-500 hover:to-brand-400 active:scale-[0.99]"
                  >
                    <Lock className="h-4 w-4 opacity-90" aria-hidden />
                    {t("p2p.tradeCta")}
                    <ArrowRight className="h-4 w-4 opacity-90" aria-hidden />
                  </Link>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <div className="mt-2 rounded-3xl border border-dashed border-slate-300/80 bg-slate-50/80 px-6 py-12 text-center dark:border-white/12 dark:bg-white/[0.03]">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500/20 to-primary-600/20 dark:from-brand-500/15 dark:to-primary-900/40">
            <div className="relative">
              <div className="absolute -left-1 -top-1 h-8 w-14 rounded-lg bg-white/30 dark:bg-white/10" />
              <div className="absolute -bottom-1 right-0 h-7 w-12 rounded-lg bg-brand-400/40" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/40 bg-white/90 shadow-lg dark:border-white/10 dark:bg-zinc-900/90">
                <ArrowRight className="h-6 w-6 text-brand-600 dark:text-brand-400" aria-hidden />
              </div>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("p2p.emptyTitle")}</h2>
          <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-slate-600 dark:text-zinc-500">
            {t("p2p.emptyBody")}
          </p>
          <p className="mt-6 text-xs text-slate-400 dark:text-zinc-600">{t("p2p.empty")}</p>
        </div>
      )}

      <p className="mt-8 text-center text-[11px] leading-relaxed text-slate-400 dark:text-zinc-600">
        {t("p2p.footerTrust")}
      </p>
    </div>
  );
}
