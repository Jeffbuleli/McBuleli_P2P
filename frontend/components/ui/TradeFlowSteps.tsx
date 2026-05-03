"use client";

import { Check } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

type StepVisual = "done" | "current" | "upcoming";

function stepVisuals(status: string): StepVisual[] {
  switch (status) {
    case "RELEASED":
      return ["done", "done", "done", "done", "done"];
    case "PAID":
      return ["done", "done", "done", "current", "upcoming"];
    case "PENDING":
      return ["done", "current", "upcoming", "upcoming", "upcoming"];
    case "DISPUTED":
      return ["done", "done", "current", "upcoming", "upcoming"];
    case "CANCELLED":
      return ["upcoming", "upcoming", "upcoming", "upcoming", "upcoming"];
    default:
      return ["done", "current", "upcoming", "upcoming", "upcoming"];
  }
}

export function TradeFlowSteps({ status }: { status: string }) {
  const { t } = useI18n();
  const labels = [
    t("tradeRoom.stepOrder"),
    t("tradeRoom.stepPay"),
    t("tradeRoom.stepMarked"),
    t("tradeRoom.stepRelease"),
    t("tradeRoom.stepDone"),
  ];

  const visuals = stepVisuals(status);
  const cancelled = status === "CANCELLED";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-card dark:border-white/10 dark:bg-surface-secondary/80">
      <p className="mb-4 text-xs text-slate-500 dark:text-zinc-500">{t("tradeRoom.escrowLine")}</p>
      <ol className="flex items-start justify-between gap-0.5">
        {labels.map((label, i) => {
          const v = cancelled ? "upcoming" : visuals[i];
          const isDone = v === "done";
          const isCurrent = v === "current";
          const isLast = i === labels.length - 1;

          return (
            <li key={label} className="relative flex min-w-0 flex-1 flex-col items-center">
              {!isLast && (
                <div
                  className={`absolute left-[calc(50%+12px)] top-[11px] z-0 h-0.5 w-[calc(100%-24px)] ${
                    !cancelled && visuals[i] === "done" ? "bg-brand-500" : "bg-slate-200 dark:bg-zinc-700"
                  }`}
                  aria-hidden
                />
              )}
              <span
                className={`relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[9px] font-bold sm:h-7 sm:w-7 sm:text-[10px] ${
                  cancelled
                    ? "border-slate-300 bg-slate-100 text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600"
                    : isDone
                      ? "border-brand-500 bg-brand-500 text-white"
                      : isCurrent
                        ? "border-brand-400 bg-brand-500/20 text-brand-700 ring-2 ring-brand-500/30 dark:text-brand-300"
                        : "border-slate-200 bg-white text-slate-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-600"
                }`}
              >
                {isDone && !cancelled ? <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden /> : i + 1}
              </span>
              <span
                className={`mt-1.5 max-w-[4.2rem] text-center text-[8px] font-medium leading-tight sm:max-w-none sm:text-[10px] ${
                  isCurrent ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-zinc-500"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      {cancelled && (
        <p className="mt-3 text-center text-xs font-medium text-red-600 dark:text-red-400">
          {t("tradeRoom.status.CANCELLED")}
        </p>
      )}
    </div>
  );
}
