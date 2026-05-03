"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TradeFlowSteps } from "@/components/ui/TradeFlowSteps";

type OfferSlice = {
  side: string;
  fiatCurrency: string;
  pricePerUnit: string;
  paymentMethods: unknown;
};

type Trade = {
  id: string;
  referenceId: string;
  status: string;
  cryptoAmount: string;
  fiatAmount: string;
  timerEndsAt: string;
  buyerId: string;
  sellerId: string;
  offer?: OfferSlice;
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

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TradeRoomPage() {
  const { t, locale } = useI18n();
  const params = useParams();
  const id = params.id as string;
  const [trade, setTrade] = useState<Trade | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeErr, setDisputeErr] = useState<string | null>(null);

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

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

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

  async function submitDispute(e: React.FormEvent) {
    e.preventDefault();
    setDisputeErr(null);
    const reason = disputeReason.trim();
    if (reason.length < 5) {
      setDisputeErr(t("tradeRoom.disputeTooShort"));
      return;
    }
    try {
      await api(`/api/p2p/trades/${id}/dispute`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setDisputeReason("");
      await refresh();
    } catch (err: unknown) {
      setDisputeErr(err instanceof Error ? err.message : "Error");
    }
  }

  const countdownMs = useMemo(() => {
    if (!trade) return 0;
    return new Date(trade.timerEndsAt).getTime() - now;
  }, [trade, now]);

  if (!trade || !me) return <p className="text-slate-500 dark:text-zinc-500">{t("tradeRoom.loading")}</p>;

  const role = me === trade.buyerId ? "buyer" : "seller";
  const roleLabel = role === "buyer" ? t("tradeRoom.buyer") : t("tradeRoom.seller");
  const localeTag = locale === "fr" ? "fr-FR" : "en-US";

  const paymentMethodsRaw = trade.offer?.paymentMethods;
  const paymentLines = Array.isArray(paymentMethodsRaw)
    ? paymentMethodsRaw
    : typeof paymentMethodsRaw === "object" && paymentMethodsRaw !== null
      ? Object.entries(paymentMethodsRaw as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`)
      : [];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <TradeFlowSteps status={trade.status} />

      <div>
        <p className="text-xs text-slate-500 dark:text-zinc-500">{trade.referenceId}</p>
        <h1 className="text-xl font-semibold capitalize text-slate-900 dark:text-white">
          {tradeStatusLabel(trade.status, t)}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          {trade.cryptoAmount} USDT · {trade.fiatAmount} {trade.offer?.fiatCurrency ?? ""} · {t("tradeRoom.youAre")}{" "}
          {roleLabel}
        </p>
        {trade.status === "PENDING" && (
          <p className="mt-2 text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-400">
            {t("tradeRoom.countdown")} {formatCountdown(countdownMs)}
          </p>
        )}
        <p className="text-xs text-slate-500 dark:text-zinc-600">
          {t("tradeRoom.timerEnds")}{" "}
          {new Date(trade.timerEndsAt).toLocaleString(localeTag)}
        </p>
      </div>

      {trade.offer && (
        <Card className="p-4">
          <h2 className="text-sm font-medium text-slate-800 dark:text-zinc-200">{t("tradeRoom.paymentInstructions")}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
            {t("tradeRoom.offPlatform")} · {trade.offer.side === "SELL" ? t("tradeRoom.sendToSeller") : t("tradeRoom.followOffer")}
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-zinc-300">
            {paymentLines.length ? (
              paymentLines.map((line, i) => (
                <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-950/80">
                  {typeof line === "string" ? line : JSON.stringify(line)}
                </li>
              ))
            ) : (
              <li className="text-slate-500">{t("tradeRoom.noPaymentDetails")}</li>
            )}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {trade.status === "PENDING" && role === "buyer" && (
          <Button variant="primary" size="sm" type="button" onClick={() => action("/pay")}>
            {t("tradeRoom.iHavePaid")}
          </Button>
        )}
        {trade.status === "PAID" && role === "seller" && (
          <Button variant="primary" size="sm" type="button" onClick={() => action("/release")}>
            {t("tradeRoom.confirmRelease")}
          </Button>
        )}
        {trade.status === "PENDING" && (
          <Button variant="outline" size="sm" type="button" onClick={() => action("/cancel")}>
            {t("common.cancel")}
          </Button>
        )}
      </div>

      {(trade.status === "PAID" || trade.status === "PENDING") && (
        <Card className="space-y-2 p-4">
          <h2 className="text-sm font-medium text-slate-800 dark:text-zinc-200">{t("tradeRoom.openDispute")}</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-500">{t("tradeRoom.disputeHint")}</p>
          <form onSubmit={submitDispute} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <input
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder={t("tradeRoom.disputePlaceholder")}
            />
            <Button type="submit" variant="outline" size="sm">
              {t("tradeRoom.disputeSubmit")}
            </Button>
          </form>
          {disputeErr && <p className="text-xs text-red-600 dark:text-red-400">{disputeErr}</p>}
        </Card>
      )}

      <Card className="p-3">
        <h2 className="text-sm font-medium text-slate-700 dark:text-zinc-400">{t("tradeRoom.chat")}</h2>
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
          {msgs.map((m) => (
            <li key={m.id} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-zinc-950/80">
              <span className="text-xs text-slate-500 dark:text-zinc-500">
                @{m.sender.username} · {new Date(m.createdAt).toLocaleString(localeTag)}
              </span>
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
