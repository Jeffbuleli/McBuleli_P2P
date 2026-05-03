"use client";

import { AlertTriangle, Check, Lock } from "lucide-react";
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
  const disputed = status === "DISPUTED";

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-card dark:border-white/[0.08] dark:bg-gradient-to-br dark:from-surface-secondary dark:via-surface-secondary dark:to-earth-950/40 dark:shadow-card">
      <div className="border-b border-slate-100 bg-slate-50/95 px-4 py-3 dark:border-white/5 dark:bg-black/25">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/12 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Lock className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-xs font-medium leading-snug text-slate-600 dark:text-zinc-400">{t("tradeRoom.escrowLine")}</p>
        </div>
      </div>

      <div className="px-2 pb-4 pt-3 sm:px-4">
        <ol className="flex items-start justify-between gap-0">
          {labels.map((label, i) => {
            const v = cancelled ? "upcoming" : visuals[i];
            const isDone = v === "done";
            const isCurrent = v === "current";
            const isLast = i === labels.length - 1;
            const connectorDone = !cancelled && visuals[i] === "done";

            const ringDisputed = disputed && isCurrent;

            return (
              <li key={label} className="relative flex min-w-0 flex-1 flex-col items-center">
                {!isLast && (
                  <div
                    className={`absolute left-[calc(50%+14px)] top-[13px] z-0 h-[3px] w-[calc(100%-28px)] rounded-full ${
                      connectorDone ? "bg-gradient-to-r from-brand-500 to-brand-400" : "bg-slate-200/90 dark:bg-zinc-800"
                    }`}
                    aria-hidden
                  />
                )}
                <span
                  className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold shadow-sm sm:h-8 sm:w-8 sm:text-[11px] ${
                    cancelled
                      ? "border-slate-300 bg-slate-100 text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600"
                      : ringDisputed
                        ? "border-amber-400 bg-amber-500/20 text-amber-800 ring-2 ring-amber-500/35 dark:text-amber-200"
                        : isDone
                            ? "border-brand-500 bg-brand-500 text-white shadow-brand-900/30"
                            : isCurrent
                              ? "border-brand-400 bg-brand-500/25 text-brand-800 ring-2 ring-brand-500/40 dark:text-brand-200"
                              : "border-slate-200 bg-white text-slate-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-600"
                  }`}
                >
                  {isDone && !cancelled ? (
                    <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden strokeWidth={2.5} />
                  ) : ringDisputed && isCurrent ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" aria-hidden />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`mt-2 max-w-[4rem] text-center text-[8px] font-semibold uppercase leading-tight tracking-wide sm:max-w-none sm:text-[9px] ${
                    isCurrent && !cancelled
                      ? disputed
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-brand-600 dark:text-brand-400"
                      : "text-slate-500 dark:text-zinc-500"
                  }`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        {cancelled && (
          <p className="mt-4 text-center text-xs font-semibold text-red-600 dark:text-red-400">{t("tradeRoom.status.CANCELLED")}</p>
        )}
        {disputed && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("tradeRoom.disputedBanner")}
          </p>
        )}
      </div>
    </div>
  );
}
