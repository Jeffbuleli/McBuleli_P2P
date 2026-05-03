"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleSlash,
  Clock,
  Copy,
  Lock,
  MessageCircle,
  Shield,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TradeFlowSteps } from "@/components/ui/TradeFlowSteps";

type OfferSlice = {
  side: string;
  fiatCurrency: string;
  pricePerUnit?: string;
  cryptoAsset?: string;
  paymentMethods: unknown;
};

type Trade = {
  id: string;
  referenceId: string;
  status: string;
  cryptoAmount: string;
  fiatAmount: string;
  timerEndsAt: string;
  createdAt: string;
  buyerId: string;
  sellerId: string;
  offer?: OfferSlice;
};

type Msg = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; username: string };
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

function normalizePaymentLines(methods: unknown): string[] {
  if (methods == null) return [];
  if (Array.isArray(methods)) {
    return methods.map((m) => {
      if (typeof m === "string") return m.replace(/_/g, " ").trim() || m;
      if (m && typeof m === "object") {
        const o = m as Record<string, unknown>;
        if (typeof o.label === "string") return o.label;
      }
      try {
        return JSON.stringify(m).slice(0, 48);
      } catch {
        return "—";
      }
    });
  }
  if (typeof methods === "object") {
    return Object.entries(methods as Record<string, unknown>).map(([k, v]) =>
      `${k}: ${String(v)}`.slice(0, 56),
    );
  }
  return [];
}

function statusStyles(status: string): string {
  switch (status) {
    case "PENDING":
      return "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200";
    case "PAID":
      return "border-sky-500/35 bg-sky-500/10 text-sky-900 dark:text-sky-200";
    case "RELEASED":
      return "border-brand-500/40 bg-brand-500/10 text-brand-900 dark:text-brand-200";
    case "CANCELLED":
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
    case "DISPUTED":
      return "border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-100";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-zinc-300";
  }
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
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const [tr, u, m] = await Promise.all([
      api<Trade>(`/api/p2p/trades/${id}`),
      api<{ id: string }>("/api/users/me"),
      api<Msg[]>(`/api/p2p/trades/${id}/messages`),
    ]);
    setTrade(tr);
    setMe(u.id);
    setMsgs(m);
  }, [id]);

  useEffect(() => {
    refresh().catch(console.error);
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

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

  function copyRef() {
    if (!trade) return;
    void navigator.clipboard?.writeText(trade.referenceId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const countdownMs = useMemo(() => {
    if (!trade) return 0;
    return new Date(trade.timerEndsAt).getTime() - now;
  }, [trade, now]);

  const timerProgressPct = useMemo(() => {
    if (!trade || trade.status !== "PENDING") return 0;
    const end = new Date(trade.timerEndsAt).getTime();
    const start = new Date(trade.createdAt).getTime();
    const total = Math.max(1, end - start);
    const left = Math.max(0, end - now);
    return Math.min(100, Math.max(0, (left / total) * 100));
  }, [trade, now]);

  const localeTag = locale === "fr" ? "fr-FR" : "en-US";

  if (!trade || !me) {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-36 w-full rounded-3xl" />
      </div>
    );
  }

  const role = me === trade.buyerId ? "buyer" : "seller";
  const roleLabel = role === "buyer" ? t("tradeRoom.buyer") : t("tradeRoom.seller");
  const cryptoCode = trade.offer?.cryptoAsset ?? "USDT";
  const paymentLines = normalizePaymentLines(trade.offer?.paymentMethods);
  const counterpartyHint =
    role === "buyer"
      ? trade.status === "PENDING"
        ? t("tradeRoom.hintBuyerPay")
        : trade.status === "PAID"
          ? t("tradeRoom.hintBuyerWait")
          : null
      : trade.status === "PENDING"
        ? t("tradeRoom.hintSellerWaitPay")
        : trade.status === "PAID"
          ? t("tradeRoom.hintSellerRelease")
          : null;

  return (
    <div className="flex flex-col gap-5 pb-28 md:pb-10">
      {/* Hero summary */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 px-4 py-5 shadow-card-lg dark:border-white/10 dark:from-primary-950/85 dark:via-surface-secondary dark:to-earth-950/25 dark:shadow-card-lg">
        <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-brand-400/15 blur-2xl dark:bg-brand-500/20" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusStyles(trade.status)}`}
              >
                {tradeStatusLabel(trade.status, t)}
              </span>
              <button
                type="button"
                onClick={copyRef}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/15 dark:bg-black/20 dark:text-zinc-300 dark:shadow-none dark:hover:bg-white/10"
                title={t("tradeRoom.copyRef")}
              >
                {copied ? (
                  <span className="text-brand-600 dark:text-brand-400">{t("tradeRoom.copied")}</span>
                ) : (
                  <>
                    {trade.referenceId}
                    <Copy className="h-3 w-3 opacity-70" aria-hidden />
                  </>
                )}
              </button>
            </div>
            <h1 className="mt-3 text-balance text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t("tradeRoom.roomTitle")}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-zinc-400">
              {t("tradeRoom.youAre")}{" "}
              <span className="font-semibold text-slate-900 dark:text-zinc-200">{roleLabel}</span>
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-3 py-3 shadow-sm dark:border-white/10 dark:bg-black/25 dark:shadow-none">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
              {t("tradeRoom.cryptoInEscrow")}
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {trade.cryptoAmount} {cryptoCode}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-3 py-3 shadow-sm dark:border-white/10 dark:bg-black/25 dark:shadow-none">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
              {t("tradeRoom.fiatAmount")}
            </p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {trade.fiatAmount} {trade.offer?.fiatCurrency ?? ""}
            </p>
          </div>
        </div>

        {trade.status === "PENDING" && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <Clock className="h-5 w-5 shrink-0" aria-hidden />
                <span className="text-sm font-semibold">{t("tradeRoom.countdown")}</span>
              </div>
              <span className="font-mono text-2xl font-bold tabular-nums text-amber-950 dark:text-amber-100">
                {formatCountdown(countdownMs)}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-200/90 dark:bg-black/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-brand-500 transition-[width] duration-500 ease-out"
                style={{ width: `${timerProgressPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-amber-800/90 dark:text-amber-200/80">
              {t("tradeRoom.timerEnds")} {new Date(trade.timerEndsAt).toLocaleString(localeTag)}
            </p>
          </div>
        )}

        {trade.status === "RELEASED" && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-brand-400" aria-hidden />
            <p className="text-sm font-medium leading-relaxed">{t("tradeRoom.completedBanner")}</p>
          </div>
        )}

        {trade.status === "CANCELLED" && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-700 dark:border-zinc-600/40 dark:bg-zinc-800/50 dark:text-zinc-300">
            <CircleSlash className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 dark:text-zinc-400" aria-hidden />
            <p className="text-sm leading-relaxed">{t("tradeRoom.cancelledBanner")}</p>
          </div>
        )}

        {counterpartyHint && (trade.status === "PENDING" || trade.status === "PAID") && (
          <p className="mt-4 text-sm text-slate-600 dark:text-zinc-400">{counterpartyHint}</p>
        )}
      </section>

      <TradeFlowSteps status={trade.status} />

      {/* Payment rails */}
      {trade.offer && trade.status !== "RELEASED" && trade.status !== "CANCELLED" && (
        <Card className="overflow-hidden border-slate-200/90 p-0 dark:border-white/10 dark:bg-surface-secondary/95">
          <div className="border-b border-slate-100 bg-slate-50/95 px-4 py-3 dark:border-white/5 dark:bg-black/30">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand-500" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("tradeRoom.paymentInstructions")}</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-zinc-500">
              {t("tradeRoom.offPlatform")} · {trade.offer.side === "SELL" ? t("tradeRoom.sendToSeller") : t("tradeRoom.followOffer")}
            </p>
          </div>
          <ul className="space-y-2 p-4">
            {paymentLines.length ? (
              paymentLines.map((line, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 dark:border-white/10 dark:bg-zinc-950/80 dark:text-zinc-200"
                >
                  <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-500" aria-hidden />
                  <span className="break-words">{line}</span>
                </li>
              ))
            ) : (
              <li className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500 dark:border-zinc-600 dark:bg-transparent dark:text-zinc-500">
                {t("tradeRoom.noPaymentDetails")}
              </li>
            )}
          </ul>
        </Card>
      )}

      {/* Primary actions */}
      {(trade.status === "PENDING" || trade.status === "PAID") && (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
            {t("tradeRoom.actionsTitle")}
          </p>
          {trade.status === "PENDING" && role === "buyer" && (
            <button
              type="button"
              onClick={() => action("/pay")}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-base font-semibold text-white shadow-lg shadow-brand-900/30 transition hover:from-brand-500 hover:to-brand-400 active:scale-[0.99]"
            >
              <Lock className="h-5 w-5" aria-hidden />
              {t("tradeRoom.iHavePaid")}
              <ArrowRight className="h-5 w-5 opacity-90" aria-hidden />
            </button>
          )}
          {trade.status === "PAID" && role === "seller" && (
            <button
              type="button"
              onClick={() => action("/release")}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-base font-semibold text-white shadow-lg shadow-brand-900/30 transition hover:from-brand-500 hover:to-brand-400 active:scale-[0.99]"
            >
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              {t("tradeRoom.confirmRelease")}
            </button>
          )}
          {trade.status === "PENDING" && (
            <Button variant="outline" size="lg" type="button" className="w-full" onClick={() => action("/cancel")}>
              {t("common.cancel")}
            </Button>
          )}
        </div>
      )}

      {/* Dispute */}
      {(trade.status === "PAID" || trade.status === "PENDING") && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-500/25 dark:bg-amber-950/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">{t("tradeRoom.openDispute")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">{t("tradeRoom.disputeHint")}</p>
              <form onSubmit={submitDispute} className="mt-3 flex flex-col gap-2">
                <input
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-amber-500/20 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/20 dark:border-amber-500/20 dark:bg-zinc-950 dark:text-zinc-100"
                  placeholder={t("tradeRoom.disputePlaceholder")}
                />
                <Button type="submit" variant="outline" size="md" className="w-full border-amber-500/40 text-amber-900 hover:bg-amber-500/10 dark:text-amber-200">
                  {t("tradeRoom.disputeSubmit")}
                </Button>
              </form>
              {disputeErr && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{disputeErr}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      <Card className="overflow-hidden border-slate-200/90 p-0 dark:border-white/10 dark:bg-surface-secondary/95">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/95 px-4 py-3 dark:border-white/5 dark:bg-black/25">
          <MessageCircle className="h-4 w-4 text-brand-500" aria-hidden />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("tradeRoom.chat")}</h2>
        </div>
        <ul className="max-h-72 space-y-3 overflow-y-auto bg-white px-3 py-4 sm:px-4 dark:bg-transparent">
          {msgs.length === 0 && (
            <li className="py-8 text-center text-sm text-slate-500 dark:text-zinc-500">{t("tradeRoom.chatEmpty")}</li>
          )}
          {msgs.map((m) => {
            const mine = m.sender.id === me;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[75%] ${
                    mine
                      ? "rounded-br-md bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-md shadow-brand-900/15"
                      : "rounded-bl-md border border-slate-200 bg-slate-100 text-slate-800 shadow-sm dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-100"
                  }`}
                >
                  {!mine && (
                    <p className="mb-1 text-[10px] font-semibold text-brand-700 dark:text-brand-400">
                      @{m.sender.username}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                  <p className={`mt-1.5 text-[10px] ${mine ? "text-white/75" : "text-slate-500 dark:text-zinc-500"}`}>
                    {new Date(m.createdAt).toLocaleString(localeTag)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <form onSubmit={sendChat} className="flex gap-2 border-t border-slate-100 bg-slate-50/90 p-3 dark:border-white/5 dark:bg-black/20">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
            placeholder={t("tradeRoom.messagePlaceholder")}
            maxLength={4000}
          />
          <Button type="submit" variant="primary" size="md" className="shrink-0 px-5">
            {t("common.send")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
