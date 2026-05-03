"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TradeFlowSteps } from "@/components/ui/TradeFlowSteps";

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

function tradeStatusLabel(status: string, t: (key: string) => string): string {
  const key = `tradeRoom.status.${status}`;
  const out = t(key);
  if (out !== key) return out;
  return status.replace(/_/g, " ").toLowerCase();
}

export default function TradeRoomPage() {
  const { t, locale } = useI18n();
  const params = useParams();
  const id = params.id as string;
  const [trade, setTrade] = useState<Trade | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [me, setMe] = useState<string | null>(null);

  async function refresh() {
    const [tr, u, m] = await Promise.all([
      api<Trade>(`/api/p2p/trades/${id}`),
      api<{ id: string }>("/api/users/me"),
      api<Msg[]>(`/api/p2p/trades/${id}/messages`),
    ]);
    setTrade(tr);
    setMe(u.id);
    setMsgs(m);
  }

  useEffect(() => {
    refresh().catch(console.error);
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
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

  if (!trade || !me) return <p className="text-slate-500 dark:text-zinc-500">{t("tradeRoom.loading")}</p>;

  const role = me === trade.buyerId ? "buyer" : "seller";
  const roleLabel = role === "buyer" ? t("tradeRoom.buyer") : t("tradeRoom.seller");
  const localeTag = locale === "fr" ? "fr-FR" : "en-US";

  return (
    <div className="flex flex-col gap-6 pb-8">
      <TradeFlowSteps status={trade.status} />

      <div>
        <p className="text-xs text-slate-500 dark:text-zinc-500">{trade.referenceId}</p>
        <h1 className="text-xl font-semibold capitalize text-slate-900 dark:text-white">
          {tradeStatusLabel(trade.status, t)}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          {trade.cryptoAmount} crypto · {trade.fiatAmount} fiat · {t("tradeRoom.youAre")} {roleLabel}
        </p>
        <p className="text-xs text-slate-500 dark:text-zinc-600">
          {t("tradeRoom.timerEnds")}{" "}
          {new Date(trade.timerEndsAt).toLocaleString(localeTag)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {trade.status === "AWAITING_PAYMENT" && role === "buyer" && (
          <Button variant="primary" size="sm" type="button" onClick={() => action("/paid")}>
            {t("tradeRoom.paidSeller")}
          </Button>
        )}
        {trade.status === "PAID" && role === "seller" && (
          <Button variant="primary" size="sm" type="button" onClick={() => action("/confirm")}>
            {t("tradeRoom.confirmRelease")}
          </Button>
        )}
        {(trade.status === "AWAITING_PAYMENT" || trade.status === "PAID") && (
          <Button variant="outline" size="sm" type="button" onClick={() => action("/cancel")}>
            {t("common.cancel")}
          </Button>
        )}
      </div>

      <Card className="p-3">
        <h2 className="text-sm font-medium text-slate-700 dark:text-zinc-400">{t("tradeRoom.chat")}</h2>
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
          {msgs.map((m) => (
            <li key={m.id} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-zinc-950/80">
              <span className="text-xs font-medium text-brand-600 dark:text-brand-400">@{m.sender.username}</span>
              <p className="text-slate-800 dark:text-zinc-200">{m.body}</p>
            </li>
          ))}
        </ul>
        <form onSubmit={sendChat} className="mt-3 flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
            placeholder={t("tradeRoom.messagePlaceholder")}
          />
          <Button type="submit" variant="outline" size="sm">
            {t("common.send")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
