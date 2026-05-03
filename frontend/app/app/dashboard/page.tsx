"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Send, Shield } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { PriceSparkline } from "@/components/ui/PriceSparkline";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

type Me = {
  fullName: string;
  email: string;
  kycStatus: string;
  p2pRatingAvg: string | number;
  completedTrades: number;
  emailVerifiedAt: string | null;
  isAdmin?: boolean;
  staffRoles?: string[];
};

type WalletRow = {
  id: string;
  kind: string;
  currencyCode: string;
  balance: string;
  lockedBalance: string;
};

type Tx = {
  id: string;
  type: string;
  status: string;
  amount: string | { toString(): string };
  currency: string;
  createdAt: string;
};

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [balances, setBalances] = useState<WalletRow[] | null>(null);
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await api<Me>("/api/users/me");
        if (cancelled) return;
        setMe(u);
        const [b, tx] = await Promise.all([
          api<WalletRow[]>("/api/wallet/balances").catch(() => []),
          api<Tx[]>("/api/wallet/transactions").catch(() => []),
        ]);
        if (cancelled) return;
        setBalances(b);
        setTxs(tx);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const localeTag = locale === "fr" ? "fr-FR" : "en-US";

  if (err) {
    return (
      <Card>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          {err === "UNAUTHORIZED" || err === "INVALID_TOKEN" ? (
            <Link href="/auth/login" className="font-medium text-brand-600 dark:text-brand-400">
              {t("dashboard.signIn")}
            </Link>
          ) : (
            err
          )}
        </p>
      </Card>
    );
  }

  if (!me || !balances || !txs) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <SkeletonText lines={3} />
      </div>
    );
  }

  const recent = txs.slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("dashboard.hello", { name: me.fullName })}</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-500">{me.email}</p>
      </div>

      {!me.emailVerifiedAt && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {t("dashboard.verifyEmail")}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 bg-gradient-to-br from-primary-950/90 to-slate-900 px-4 py-4 dark:border-white/[0.06] dark:from-primary-950 dark:to-surface-secondary">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-200/90">{t("dashboard.totalBalance")}</p>
              <p className="mt-1 text-xs text-primary-200/80">{t("dashboard.portfolioHint")}</p>
            </div>
            <Shield className="h-8 w-8 shrink-0 text-brand-400/90" aria-hidden />
          </div>
          <ul className="mt-4 space-y-2">
            {balances.length === 0 ? (
              <p className="text-sm text-primary-100/90">{t("dashboard.noBalances")}</p>
            ) : (
              balances.slice(0, 4).map((w) => (
                <li key={w.id} className="flex items-center justify-between text-sm">
                  <span className="text-primary-100/90">
                    {w.currencyCode}{" "}
                    <span className="text-xs text-primary-300/70">({w.kind})</span>
                  </span>
                  <span className="font-mono tabular-nums text-white">{w.balance}</span>
                </li>
              ))
            )}
          </ul>
          <Link href="/app/wallet" className="mt-4 inline-flex text-xs font-semibold text-brand-300 hover:text-white">
            {t("dashboard.openWallet")} →
          </Link>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-xs text-slate-500 dark:text-zinc-500">{t("dashboard.kyc")}</p>
          <p className="mt-1 font-medium capitalize text-slate-900 dark:text-white">{me.kycStatus.toLowerCase()}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 dark:text-zinc-500">{t("dashboard.trustScore")}</p>
          <p className="mt-1 font-medium text-slate-900 dark:text-white">
            {Number(me.p2pRatingAvg).toFixed(1)} · {me.completedTrades} {t("dashboard.tradesSuffix")}
          </p>
        </Card>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-zinc-200">{t("dashboard.quickActions")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link href="/app/wallet" className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 text-center shadow-sm transition hover:border-brand-500/30 dark:border-white/10 dark:bg-surface-secondary/80">
            <ArrowDownCircle className="h-6 w-6 text-brand-500" aria-hidden />
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100">{t("dashboard.deposit")}</span>
          </Link>
          <Link href="/app/wallet" className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 text-center shadow-sm transition hover:border-brand-500/30 dark:border-white/10 dark:bg-surface-secondary/80">
            <ArrowUpCircle className="h-6 w-6 text-brand-500" aria-hidden />
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100">{t("dashboard.withdraw")}</span>
          </Link>
          <Link href="/app/wallet" className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 text-center shadow-sm transition hover:border-brand-500/30 dark:border-white/10 dark:bg-surface-secondary/80">
            <Send className="h-6 w-6 text-primary-500 dark:text-primary-400" aria-hidden />
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100">{t("dashboard.send")}</span>
          </Link>
          <Link href="/app/p2p" className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 text-center shadow-sm transition hover:border-brand-500/30 dark:border-white/10 dark:bg-surface-secondary/80">
            <ArrowLeftRight className="h-6 w-6 text-brand-500" aria-hidden />
            <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100">{t("dashboard.tradeP2p")}</span>
          </Link>
        </div>
      </div>

      <PriceSparkline label={t("dashboard.btcSpot")} price="$97,420" changePct={1.24} />

      <Card>
        <CardHeader title={t("dashboard.recentActivity")} />
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-zinc-500">{t("dashboard.noTransactions")}</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-white/[0.06]"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-800 dark:text-zinc-200">{tx.type.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500">
                    {new Date(tx.createdAt).toLocaleString(localeTag)} · {tx.status}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs text-slate-900 dark:text-zinc-100">
                  {String(tx.amount)} {tx.currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {(me.isAdmin || me.staffRoles?.includes("AGENT")) && (
          <Link
            href="/app/agent"
            className="inline-flex min-h-11 w-full flex-1 items-center justify-center rounded-2xl bg-primary-900 px-4 py-2.5 text-sm font-medium text-white shadow-card transition hover:bg-primary-800 dark:bg-primary-950 dark:hover:bg-primary-900 sm:w-auto"
          >
            {t("dashboard.agentOps")}
          </Link>
        )}
        {me.isAdmin && (
          <>
            <Link
              href="/app/admin/staking"
              className="inline-flex min-h-11 w-full flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-white/12 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-white/5 sm:w-auto"
            >
              {t("dashboard.adminStaking")}
            </Link>
            <Link
              href="/app/admin/roles"
              className="inline-flex min-h-11 w-full flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-white/12 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-white/5 sm:w-auto"
            >
              {t("dashboard.adminRoles")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
