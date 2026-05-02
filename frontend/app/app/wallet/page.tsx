"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type WalletRow = {
  id: string;
  kind: string;
  currencyCode: string;
  balance: string;
  lockedBalance: string;
};

export default function WalletPage() {
  const [rows, setRows] = useState<WalletRow[] | null>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("CDF");
  const [kind, setKind] = useState<"FIAT" | "CRYPTO">("FIAT");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const data = await api<WalletRow[]>("/api/wallet/balances");
    setRows(data);
  }

  useEffect(() => {
    load().catch(() => setRows([]));
  }, []);

  async function transfer(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api("/api/wallet/transfer", {
        method: "POST",
        body: JSON.stringify({ to, amount, currencyCode, kind }),
      });
      setMsg("Transfer completed.");
      setTo("");
      setAmount("");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!rows) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-white">Wallet</h1>
      <ul className="space-y-3">
        {rows.map((w) => (
          <li
            key={w.id}
            className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-white">
                {w.currencyCode}{" "}
                <span className="text-xs font-normal text-zinc-500">({w.kind})</span>
              </p>
              <p className="text-xs text-zinc-500">
                Locked: {w.lockedBalance}
              </p>
            </div>
            <p className="font-mono text-lg text-brand-300">{w.balance}</p>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="text-sm font-medium text-zinc-400">Internal transfer</h2>
        <form onSubmit={transfer} className="mt-3 space-y-3">
          <input
            placeholder="Recipient email or username"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "FIAT" | "CRYPTO")}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm"
            >
              <option value="FIAT">Fiat</option>
              <option value="CRYPTO">Crypto</option>
            </select>
            <select
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 text-sm"
            >
              <option value="CDF">CDF</option>
              <option value="USD">USD</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
          <input
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
          />
          {msg && <p className="text-sm text-brand-300">{msg}</p>}
          <button type="submit" className="w-full rounded-xl bg-zinc-800 py-2 text-sm font-medium text-white">
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
