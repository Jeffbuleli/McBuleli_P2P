"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, TrendingUp, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";

type Pool = {
  id: string;
  slug: string;
  asset: string;
  nameFr: string | null;
  nameEn: string | null;
  apyAnnual: string;
  lockDays: number;
  minAmount: string;
  maxStakePerUser: string | null;
  rewardFeePercent: string;
  cooldownSeconds: number;
};

type StakeRow = {
  id: string;
  poolSlug: string;
  asset: string;
  amount: string;
  apySnapshot: string;
  lockDaysSnapshot: number;
  rewardFeePercentSnapshot: string;
  startedAt: string;
  maturesAt: string;
  status: string;
  projectedGrossReward: string | null;
  projectedReward: string;
  totalAtMaturity: string;
  settledAt: string | null;
};

type BalRow = {
  kind: string;
  currencyCode: string;
  balance: string;
  lockedBalance: string;
};

function cooldownHuman(seconds: number, t: (key: string, vars?: Record<string, string>) => string): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return t("staking.cooldownSec", { n: String(seconds) });
  if (seconds < 3600) return t("staking.cooldownMin", { n: String(Math.floor(seconds / 60)) });
  const h = seconds / 3600;
  const n = h >= 10 ? String(Math.round(h)) : h.toFixed(1).replace(/\.0$/, "");
  return t("staking.cooldownHour", { n });
}

export default function StakingPage() {
  const { t, locale } = useI18n();
  const [pools, setPools] = useState<Pool[]>([]);
  const [stakes, setStakes] = useState<StakeRow[]>([]);
  const [balances, setBalances] = useState<BalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [amountIn, setAmountIn] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const poolName = useCallback(
    (p: Pool) => (locale === "fr" ? p.nameFr ?? p.slug : p.nameEn ?? p.slug),
    [locale],
  );

  const refresh = useCallback(() => {
    setErr(null);
    return Promise.all([
      api<Pool[]>("/api/staking/pools"),
      api<StakeRow[]>("/api/staking/mine"),
      api<BalRow[]>("/api/wallet/balances"),
    ])
      .then(([p, s, b]) => {
        setPools(p);
        setStakes(s);
        setBalances(b);
        setSelectedPoolId((prev) => (prev && p.some((x) => x.id === prev) ? prev : p[0]?.id ?? null));
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Error"));
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const usdtAvail = useMemo(() => {
    const row = balances.find((x) => x.kind === "CRYPTO" && x.currencyCode === "USDT");
    return row ? row.balance : "0";
  }, [balances]);

  const selectedPool = pools.find((p) => p.id === selectedPoolId) ?? null;

  async function onStake(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPoolId || !amountIn.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      await api<{ stakeId: string }>("/api/staking/stakes", {
        method: "POST",
        body: JSON.stringify({ poolId: selectedPoolId, amount: amountIn.trim() }),
      });
      setAmountIn("");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      const key = `staking.errors.${msg}`;
      const translated = t(key);
      setErr(translated !== key ? translated : msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-earth-200/80">{t("common.loading")}</p>;
  }

  if (err && !pools.length && !stakes.length) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
        {err === "UNAUTHORIZED" || err === "INVALID_TOKEN" ? (
          <Link href="/auth/login" className="text-brand-400">
            {t("dashboard.signIn")}
          </Link>
        ) : (
          err
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-1">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-brand-400">
            <TrendingUp className="h-6 w-6" strokeWidth={1.5} aria-hidden />
            <h1 className="text-xl font-semibold text-white">{t("staking.title")}</h1>
          </div>
          <p className="mt-1 text-sm text-earth-200/85">{t("staking.subtitleLive")}</p>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-earth-500">{t("staking.rulesLegal")}</p>
        </div>
        <Link
          href="/app/dashboard"
          className="text-sm text-brand-300/90 underline-offset-4 hover:text-brand-200 hover:underline"
        >
          {t("staking.cta")}
        </Link>
      </div>

      <div className="rounded-2xl border border-earth-800/80 bg-gradient-to-br from-brand-950/50 to-earth-950/60 px-4 py-4 shadow-[0_0_32px_-12px_rgba(16,185,129,0.25)]">
        <div className="flex items-center gap-2 text-earth-100">
          <Wallet className="h-5 w-5 text-brand-400" aria-hidden />
          <span className="text-sm font-medium">{t("staking.availableUsdt")}</span>
        </div>
        <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-white">{usdtAvail}</p>
        <p className="mt-1 text-xs text-earth-400">{t("staking.availableHint")}</p>
      </div>

      {err && (
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/25 px-4 py-2 text-sm text-amber-100">
          {err}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-earth-400">{t("staking.pools")}</h2>
        {pools.length === 0 ? (
          <p className="text-sm text-earth-500">{t("staking.noPools")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pools.map((p) => {
              const sel = p.id === selectedPoolId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPoolId(p.id)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    sel
                      ? "border-brand-600/80 bg-brand-950/40 shadow-[0_0_24px_-8px_rgba(16,185,129,0.4)]"
                      : "border-earth-800/70 bg-earth-950/40 hover:border-earth-700"
                  }`}
                >
                  <p className="font-medium text-white">{poolName(p)}</p>
                  <p className="mt-2 text-2xl font-semibold text-brand-300">{p.apyAnnual}%</p>
                  <p className="text-xs text-earth-400">{t("staking.apyYear")}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-earth-300">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {t("staking.lockDays", { days: String(p.lockDays) })}
                    </span>
                    <span>
                      {t("staking.min")} {p.minAmount} {p.asset}
                    </span>
                  </div>
                  {Number(p.rewardFeePercent) > 0 && (
                    <p className="mt-2 text-xs text-earth-500">
                      {t("staking.interestFeeLine", { pct: p.rewardFeePercent })}
                    </p>
                  )}
                  {p.cooldownSeconds > 0 && (
                    <p className="mt-1 text-xs text-earth-500">
                      {t("staking.cooldownBetween", {
                        label: cooldownHuman(p.cooldownSeconds, t),
                      })}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedPool && (
        <form onSubmit={onStake} className="space-y-4 rounded-2xl border border-earth-800/80 bg-earth-950/30 p-4">
          <label className="block text-sm text-earth-300">
            {t("staking.amountLabel")}
            <input
              type="text"
              inputMode="decimal"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder={t("staking.amountPlaceholder")}
              className="mt-2 w-full rounded-xl border border-earth-700/80 bg-earth-950/80 px-4 py-3 font-mono text-white outline-none ring-brand-500/30 placeholder:text-earth-600 focus:ring-2"
            />
          </label>
          <button
            type="submit"
            disabled={submitting || !amountIn.trim()}
            className="w-full rounded-xl bg-brand-700 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting ? t("common.loading") : t("staking.stakeCta")}
          </button>
          <p className="text-xs text-earth-500">{t("staking.verifyNote")}</p>
        </form>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-earth-400">{t("staking.myPositions")}</h2>
        {stakes.length === 0 ? (
          <p className="text-sm text-earth-500">{t("staking.noPositions")}</p>
        ) : (
          <ul className="space-y-3">
            {stakes.map((s) => (
              <li
                key={s.id}
                className="rounded-2xl border border-earth-800/70 bg-earth-950/40 px-4 py-3 text-sm text-earth-200"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-white">{s.poolSlug}</span>
                  <span
                    className={
                      s.status === "ACTIVE" ? "text-brand-300" : "text-earth-400"
                    }
                  >
                    {s.status === "ACTIVE" ? t("staking.statusActive") : t("staking.statusDone")}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 font-mono text-xs text-earth-300 sm:grid-cols-2">
                  <span>
                    {t("staking.principal")}: {s.amount} {s.asset}
                  </span>
                  <span>
                    {t("staking.rewardOrProjected")}: {s.projectedReward} {s.asset}
                  </span>
                  {s.status === "ACTIVE" && s.projectedGrossReward != null && Number(s.rewardFeePercentSnapshot) > 0 && (
                    <span className="text-earth-500">
                      {t("staking.grossHint")}: {s.projectedGrossReward} {s.asset}
                    </span>
                  )}
                  <span className="sm:col-span-2">
                    {t("staking.totalAtEnd")}: {s.totalAtMaturity} {s.asset}
                  </span>
                  <span className="sm:col-span-2">
                    {s.status === "ACTIVE" ? t("staking.matures") : t("staking.settled")}:{" "}
                    {new Date(s.status === "ACTIVE" ? s.maturesAt : (s.settledAt ?? s.maturesAt)).toLocaleString(
                      locale === "fr" ? "fr-FR" : "en-US",
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
