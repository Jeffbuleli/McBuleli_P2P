"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

type Trade = {
  id: string;
  referenceId: string;
  status: string;
  cryptoAmount: string;
  fiatAmount: string;
  timerEndsAt: string;
  buyerId: string;
  sellerId: string;
};

type Msg = {
  id: string;
  body: string;
  createdAt: string;
  sender: { username: string };
};

export default function TradeRoomPage() {
  const params = useParams();
  const id = params.id as string;
  const [trade, setTrade] = useState<Trade | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [me, setMe] = useState<string | null>(null);

  async function refresh() {
    const [t, u, m] = await Promise.all([
      api<Trade>(`/api/p2p/trades/${id}`),
      api<{ id: string }>("/api/users/me"),
      api<Msg[]>(`/api/p2p/trades/${id}/messages`),
    ]);
    setTrade(t);
    setMe(u.id);
    setMsgs(m);
  }

  useEffect(() => {
    refresh().catch(console.error);
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [id]);

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await api(`/api/p2p/trades/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    setBody("");
    await refresh();
  }

  async function action(path: string) {
    await api(`/api/p2p/trades/${id}${path}`, { method: "POST", body: JSON.stringify({}) });
    await refresh();
  }

  if (!trade || !me) return <p className="text-zinc-500">Loading trade…</p>;

  const role = me === trade.buyerId ? "buyer" : "seller";

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div>
        <p className="text-xs text-zinc-500">{trade.referenceId}</p>
        <h1 className="text-xl font-semibold capitalize text-white">{trade.status.replace(/_/g, " ").toLowerCase()}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {trade.cryptoAmount} crypto · {trade.fiatAmount} fiat · you are the {role}
        </p>
        <p className="text-xs text-zinc-600">Timer ends {new Date(trade.timerEndsAt).toLocaleString()}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {trade.status === "AWAITING_PAYMENT" && role === "buyer" && (
          <button
            type="button"
            onClick={() => action("/paid")}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm text-white"
          >
            I paid seller
          </button>
        )}
        {trade.status === "PAID" && role === "seller" && (
          <button
            type="button"
            onClick={() => action("/confirm")}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"
          >
            Confirm receipt — release crypto
          </button>
        )}
        {(trade.status === "AWAITING_PAYMENT" || trade.status === "PAID") && (
          <button
            type="button"
            onClick={() => action("/cancel")}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
        <h2 className="text-sm font-medium text-zinc-400">Chat</h2>
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
          {msgs.map((m) => (
            <li key={m.id} className="rounded-lg bg-zinc-950/80 px-3 py-2">
              <span className="text-xs text-brand-400">@{m.sender.username}</span>
              <p className="text-zinc-200">{m.body}</p>
            </li>
          ))}
        </ul>
        <form onSubmit={sendChat} className="mt-2 flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Message counterparty…"
          />
          <button type="submit" className="rounded-lg bg-zinc-800 px-3 py-2 text-sm">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
