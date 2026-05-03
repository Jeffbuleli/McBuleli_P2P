"use client";

import {
  ArrowLeftRight,
  Link2,
  Send,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

const iconClass = "h-7 w-7 text-brand-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]";

export function ExchangePillars() {
  const { t } = useI18n();

  const items = [
    { Icon: ArrowLeftRight, title: t("home.pillarP2p"), sub: t("home.pillarP2pSub") },
    { Icon: Smartphone, title: t("home.pillarMm"), sub: t("home.pillarMmSub") },
    { Icon: Link2, title: t("home.pillarChain"), sub: t("home.pillarChainSub") },
    { Icon: Send, title: t("home.pillarTransfer"), sub: t("home.pillarTransferSub") },
    { Icon: TrendingUp, title: t("home.pillarStake"), sub: t("home.pillarStakeSub") },
  ];

  return (
    <section className="mt-12 w-full">
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-earth-400">
        {t("home.pillarsTitle")}
      </p>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {items.map(({ Icon, title, sub }) => (
          <li
            key={title}
            className="flex flex-col items-center rounded-2xl border border-slate-200/90 bg-white/90 px-3 py-4 text-center shadow-card shadow-[inset_0_1px_0_0_rgba(16,185,129,0.06)] dark:border-white/[0.08] dark:bg-surface-secondary/80 dark:shadow-[inset_0_1px_0_0_rgba(16,185,129,0.1)]"
          >
            <Icon className={iconClass} strokeWidth={1.75} aria-hidden />
            <span className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
            <span className="mt-0.5 text-[11px] leading-tight text-slate-600 dark:text-earth-300/90">{sub}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
