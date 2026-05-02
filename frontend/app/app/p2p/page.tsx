"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Offer = {
  id: string;
  side: string;
  fiatCurrency: string;
  cryptoAsset: string;
  pricePerUnit: string;
  minFiat: string;
  maxFiat: string;
  user: { username: string; p2pRatingAvg: string | number; completedTrades: number };
};

export default function P2PPage() {
  const [offers, setOffers] = useState<Offer[] | null>(null);

  useEffect(() => {
    api<Offer[]>("/api/p2p/offers").then(setOffers).catch(() => setOffers([]));
  }, []);

  if (!offers) return <p className="text-zinc-500">Loading marketplace…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">P2P marketplace</h1>
      <p className="text-sm text-zinc-500">Escrow-protected trades with Mobile Money & bank rails.</p>
      <ul className="space-y-3">
        {offers.map((o) => (
          <li key={o.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-white">
                  {o.side === "SELL" ? "Sell" : "Buy"} {o.cryptoAsset} · {o.fiatCurrency}
                </p>
                <p className="text-xs text-zinc-500">
                  @{o.user.username} · {Number(o.user.p2pRatingAvg).toFixed(1)}★ · {o.user.completedTrades}{" "}
                  trades
                </p>
              </div>
              <span className="rounded-full bg-brand-950 px-2 py-0.5 text-xs text-brand-400">
                {o.pricePerUnit}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Limits {o.minFiat} – {o.maxFiat} {o.fiatCurrency}
            </p>
            <Link
              href={`/app/p2p/trade/new?offer=${o.id}`}
              className="mt-3 inline-block text-sm font-medium text-brand-400 hover:underline"
            >
              Start trade →
            </Link>
          </li>
        ))}
      </ul>
      {offers.length === 0 && (
        <p className="text-center text-sm text-zinc-600">No offers yet. Create one from the API or admin.</p>
      )}
    </div>
  );
}
