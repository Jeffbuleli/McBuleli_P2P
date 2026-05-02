"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";

function NewTradeForm() {
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
    return <p className="text-zinc-500">Missing offer. Go back to P2P.</p>;
  }

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-lg font-semibold text-white">Start trade</h1>
      <form onSubmit={start} className="space-y-3">
        <div>
          <label className="text-xs text-zinc-500">Fiat amount (within offer limits)</label>
          <input
            value={fiatAmount}
            onChange={(e) => setFiatAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
            placeholder="e.g. 100"
            required
          />
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button type="submit" className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white">
          Lock escrow & open trade
        </button>
      </form>
    </div>
  );
}

export default function NewTradePage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
      <NewTradeForm />
    </Suspense>
  );
}
