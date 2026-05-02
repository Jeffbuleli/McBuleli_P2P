"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Me = {
  fullName: string;
  email: string;
  kycStatus: string;
  p2pRatingAvg: string | number;
  completedTrades: number;
  emailVerifiedAt: string | null;
};

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Me>("/api/users/me")
      .then(setMe)
      .catch((e) => setErr(e instanceof Error ? e.message : "Error"));
  }, []);

  if (err) {
    return (
      <div className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-400">
        {err === "UNAUTHORIZED" || err === "INVALID_TOKEN" ? (
          <Link href="/auth/login" className="text-brand-400">
            Sign in
          </Link>
        ) : (
          err
        )}
      </div>
    );
  }

  if (!me) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Hello, {me.fullName}</h1>
        <p className="text-sm text-zinc-500">{me.email}</p>
      </div>
      {!me.emailVerifiedAt && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Verify your email to enable transfers and P2P. Check the server log in development for the token.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs text-zinc-500">KYC</p>
          <p className="mt-1 font-medium capitalize text-white">{me.kycStatus.toLowerCase()}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs text-zinc-500">Trust score</p>
          <p className="mt-1 font-medium text-white">
            {Number(me.p2pRatingAvg).toFixed(1)} · {me.completedTrades} trades
          </p>
        </div>
      </div>
      <Link
        href="/app/wallet"
        className="block rounded-xl bg-brand-700 px-4 py-3 text-center text-sm font-medium text-white hover:bg-brand-600"
      >
        Open wallet
      </Link>
    </div>
  );
}
