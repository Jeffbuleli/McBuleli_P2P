"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { ExchangePillars } from "@/components/ExchangePillars";
import { CryptoTicker } from "@/components/home/CryptoTicker";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { TrustRow } from "@/components/ui/TrustRow";
import { useI18n } from "@/components/I18nProvider";

export default function HomePage() {
  const { t } = useI18n();

  const stats = [
    { label: t("home.trustUsers"), value: t("home.trustUsersVal") },
    { label: t("home.trustTrades"), value: t("home.trustTradesVal") },
    { label: t("home.trustUptime"), value: t("home.trustUptimeVal") },
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 dark:from-[#06080c] dark:via-[#0d0d0f] dark:to-[#0a0c10] dark:text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-500/10 to-transparent dark:from-brand-500/15" />

      <header className="relative mx-auto flex max-w-lg items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] md:max-w-5xl">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-800 to-primary-950 shadow-card dark:from-brand-950 dark:to-earth-950">
            <Shield className="h-5 w-5 text-brand-400" aria-hidden strokeWidth={2} />
          </div>
          <span className="bg-gradient-to-r from-primary-900 to-brand-600 bg-clip-text text-lg font-bold tracking-tight text-transparent dark:from-brand-300 dark:to-earth-300">
            {t("shell.brand")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="relative mx-auto max-w-lg px-4 pb-16 pt-4 md:max-w-5xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400/95">
            {t("home.badge")}
          </p>
          <h1 className="mx-auto mt-4 max-w-md text-balance text-3xl font-bold tracking-tight text-slate-900 dark:bg-gradient-to-br dark:from-white dark:via-zinc-100 dark:to-earth-300/80 dark:bg-clip-text dark:text-transparent md:text-4xl">
            {t("home.headline")}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm font-medium text-brand-700 dark:text-brand-400/95">{t("home.subhead")}</p>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{t("home.description")}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/auth/register" className="sm:min-w-[200px]">
              <Button variant="primary" size="lg" className="w-full shadow-glow">
                {t("home.register")}
              </Button>
            </Link>
            <Link href="/auth/login" className="sm:min-w-[200px]">
              <Button variant="outline" size="lg" className="w-full">
                {t("home.login")}
              </Button>
            </Link>
          </div>

          <div className="mt-10">
            <TrustRow escrowLabel={t("home.trustEscrow")} secureLabel={t("home.trustSecure")} />
          </div>
        </div>

        <div className="mt-10 space-y-4">
          <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
            {t("home.liveQuotes")}
          </p>
          <CryptoTicker />
          <ul className="grid gap-3 sm:grid-cols-3">
            {stats.map(({ label, value }) => (
              <li
                key={label}
                className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 text-center shadow-card dark:border-white/[0.08] dark:bg-surface-secondary/75"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
              </li>
            ))}
          </ul>
        </div>

        <ExchangePillars />

        <p className="mt-12 text-center text-[11px] leading-relaxed text-slate-500 dark:text-zinc-600">{t("home.disclaimer")}</p>
      </main>
    </div>
  );
}
