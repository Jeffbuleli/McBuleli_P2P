"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";

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
    return <p className="text-zinc-500">{t("tradeNew.missingOffer")}</p>;
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-lg font-semibold text-white">{t("tradeNew.title")}</h1>
      <form onSubmit={start} className="space-y-3">
        <div>
          <label className="text-xs text-zinc-500">{t("tradeNew.fiatLabel")}</label>
          <input
            value={fiatAmount}
            onChange={(e) => setFiatAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
            placeholder={t("tradeNew.fiatPlaceholder")}
            required
          />
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button type="submit" className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white">
          {t("tradeNew.submit")}
        </button>
      </form>
    </div>
  );
}

export default function NewTradePage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<p className="text-zinc-500">{t("tradeNew.loading")}</p>}>
      <NewTradeForm />
    </Suspense>
  );
}
