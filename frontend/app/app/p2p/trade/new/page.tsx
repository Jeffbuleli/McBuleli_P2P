"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock, Shield } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function NewTradeForm() {
  const { t } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const offerId = sp.get("offer") ?? "";
  const [fiatAmount, setFiatAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const trade = await api<{ id: string }>("/api/p2p/trades", {
        method: "POST",
        body: JSON.stringify({ offerId, fiatAmount }),
      });
      router.push(`/app/p2p/trade/${trade.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!offerId) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600 dark:border-white/15 dark:bg-white/[0.03] dark:text-zinc-500">
        {t("tradeNew.missingOffer")}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="rounded-3xl border border-brand-200/80 bg-gradient-to-br from-brand-50 via-white to-emerald-50/40 px-4 py-4 dark:border-brand-500/15 dark:from-brand-500/10 dark:via-transparent dark:to-primary-900/20">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
          <Shield className="h-4 w-4" aria-hidden />
          {t("tradeNew.escrowHint")}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{t("tradeNew.subtitle")}</p>
      </div>

      <Card className="space-y-4 border-slate-200/90 bg-white/95 p-5 dark:border-white/[0.08] dark:bg-surface-secondary/80">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t("tradeNew.title")}</h1>
        <form onSubmit={start} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
              {t("tradeNew.fiatLabel")}
            </label>
            <input
              value={fiatAmount}
              onChange={(e) => setFiatAmount(e.target.value)}
              inputMode="decimal"
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-medium text-slate-900 shadow-sm outline-none ring-brand-500/0 transition focus:border-brand-500/40 focus:ring-2 focus:ring-brand-500/25 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder={t("tradeNew.fiatPlaceholder")}
              required
              autoComplete="off"
            />
          </div>
          {err && <p className="text-sm text-red-500 dark:text-red-400">{err}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full gap-2">
            <Lock className="h-4 w-4" aria-hidden />
            {t("tradeNew.submit")}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function NewTradePage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<p className="text-center text-slate-500 dark:text-zinc-500">{t("tradeNew.loading")}</p>}>
      <NewTradeForm />
    </Suspense>
  );
}
