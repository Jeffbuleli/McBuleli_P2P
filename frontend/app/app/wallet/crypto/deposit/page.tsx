"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { api, authenticatedFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Net = "TRC20" | "ERC20" | "BEP20";

type SupportedResp = {
  asset: "USDT";
  minDeposit: string;
  minWithdraw: string;
  serviceFeeUsdt: string;
  minSendOnChainDeposit: string;
  networks: Record<Net, { enabled: boolean; color: string }>;
};

type IntentRow = {
  id: string;
  status: string;
  asset: string;
  network: Net;
  platformAddress: string;
  memoTag: string | null;
  minAmount: string;
  serviceFeeUsdt: string;
  confirmationsRequired: number;
  txid?: string | null;
  failureReason: string | null;
};

type CreateIntentResp = {
  intent: IntentRow;
  display: {
    minCreditToAccount: string;
    serviceFeeUsdt: string;
    minSendOnChain: string;
    feeExampleCredit: string;
    feeExampleSend: string;
    confirmationsRequired: number;
    memoTag: string | null;
  };
};

type SubmitResp =
  | { status: "CONFIRMED"; intent: IntentRow }
  | {
      status: "PENDING_VALIDATION";
      reason?: string;
      confirmations?: number;
      required?: number;
    }
  | { status: "FAILED"; reason: string };

function badgeClass(n: Net): string {
  switch (n) {
    case "TRC20":
      return "border-emerald-500/60 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
    case "ERC20":
      return "border-blue-500/60 bg-blue-500/15 text-blue-900 dark:text-blue-100";
    case "BEP20":
      return "border-amber-500/60 bg-amber-500/15 text-amber-950 dark:text-amber-100";
    default:
      return "border-slate-400/40 bg-slate-500/10 text-slate-900 dark:text-zinc-100";
  }
}

export default function CryptoDepositPage() {
  const { t } = useI18n();
  const [supported, setSupported] = useState<SupportedResp | null>(null);
  const [network, setNetwork] = useState<Net | null>(null);
  const [phase, setPhase] = useState<"pick" | "risk" | "details">("pick");
  const [riskChecked, setRiskChecked] = useState(false);
  const [intent, setIntent] = useState<IntentRow | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sentClicked, setSentClicked] = useState(false);
  const [txid, setTxid] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitOutcome, setSubmitOutcome] = useState<SubmitResp | null>(null);
  const [feeHints, setFeeHints] = useState<CreateIntentResp["display"] | null>(null);

  const netLabel = useCallback(
    (n: Net) =>
      n === "TRC20"
        ? t("wallet.cryptoDeposit.networkTrc20")
        : n === "ERC20"
          ? t("wallet.cryptoDeposit.networkErc20")
          : t("wallet.cryptoDeposit.networkBep20"),
    [t],
  );

  useEffect(() => {
    api<SupportedResp>("/api/wallet/crypto/supported")
      .then(setSupported)
      .catch(() => setSupported(null));
  }, []);

  useEffect(() => {
    if (intent?.txid) setTxid(intent.txid);
  }, [intent?.txid]);

  useEffect(() => {
    if (!intent?.id) {
      setQrUrl(null);
      return;
    }
    let url: string | null = null;
    (async () => {
      try {
        const res = await authenticatedFetch(`/api/wallet/crypto/deposit/${intent.id}/qr.png`);
        if (!res.ok) return;
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        setQrUrl(url);
      } catch {
        setQrUrl(null);
      }
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [intent?.id]);

  async function createIntent() {
    if (!network || !riskChecked) return;
    setBusy(true);
    setMsg(null);
    try {
      const out = await api<CreateIntentResp>("/api/wallet/crypto/deposit/intent", {
        method: "POST",
        body: JSON.stringify({
          asset: "USDT",
          network,
          acceptedRisk: true,
        }),
      });
      setIntent(out.intent);
      setPhase("details");
      setSentClicked(false);
      setTxid("");
      setSubmitOutcome(null);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : t("wallet.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function copyAddress() {
    if (!intent) return;
    try {
      await navigator.clipboard.writeText(intent.platformAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("COPY_FAILED");
    }
  }

  async function onHaveSent() {
    if (!intent) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/wallet/crypto/deposit/" + intent.id + "/sent", { method: "POST" });
      setSentClicked(true);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : t("wallet.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitTxid() {
    if (!intent || !txid.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const out = await api<SubmitResp>("/api/wallet/crypto/deposit/" + intent.id + "/txid", {
        method: "POST",
        body: JSON.stringify({ txid: txid.trim() }),
      });
      setSubmitOutcome(out);
      if (out.status === "CONFIRMED") setIntent(out.intent);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : t("wallet.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onRefresh() {
    if (!intent) return;
    setBusy(true);
    setMsg(null);
    try {
      const out = await api<SubmitResp>("/api/wallet/crypto/deposit/" + intent.id + "/refresh", {
        method: "POST",
      });
      setSubmitOutcome(out);
      if (out.status === "CONFIRMED" && "intent" in out) setIntent(out.intent);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : t("wallet.failed"));
    } finally {
      setBusy(false);
    }
  }

  const enabled = supported?.networks;

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <Link
          href="/app/wallet"
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200"
          aria-label={t("shell.menuBack")}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{t("wallet.cryptoDeposit.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-500">{t("wallet.cryptoDeposit.subtitle")}</p>
        </div>
      </div>

      {phase === "pick" && (
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
            {t("wallet.cryptoDeposit.networkTitle")}
          </p>
          <div className="grid gap-3">
            {(["TRC20", "ERC20", "BEP20"] as const).map((n) => {
              const on = enabled?.[n]?.enabled ?? false;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!on}
                  onClick={() => on && setNetwork(n)}
                  className={`flex min-h-[52px] items-center justify-center rounded-2xl border-2 px-4 text-sm font-semibold transition ${
                    network === n
                      ? badgeClass(n) + " ring-2 ring-brand-500/40"
                      : "border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100"
                  } ${!on ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {netLabel(n)}
                  {!on && (
                    <span className="ml-2 text-[10px] font-normal opacity-80">
                      ({t("wallet.cryptoDeposit.disabledNetwork")})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Button
            variant="primary"
            className="mt-5 w-full"
            type="button"
            disabled={!network}
            onClick={() => {
              setRiskChecked(false);
              setPhase("risk");
            }}
          >
            {t("common.continue")}
          </Button>
        </Card>
      )}

      {phase === "risk" && network && (
        <Card>
          <div className="flex gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-100">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{t("wallet.cryptoDeposit.riskTitle")}</p>
              <p>{t("wallet.cryptoDeposit.warningBody", { crypto: "USDT", network: netLabel(network) })}</p>
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-zinc-900/80">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-400 text-brand-600 focus:ring-brand-500"
              checked={riskChecked}
              onChange={(e) => setRiskChecked(e.target.checked)}
            />
            <span className="text-sm font-medium text-slate-800 dark:text-zinc-200">
              {t("wallet.cryptoDeposit.warningCheckbox")}
            </span>
          </label>

          <div className="mt-5 flex flex-col gap-2">
            <Button
              variant="primary"
              className="w-full"
              type="button"
              disabled={!riskChecked || busy}
              onClick={() => void createIntent()}
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : t("wallet.cryptoDeposit.continue")}
            </Button>
            <Button variant="ghost" type="button" className="w-full" onClick={() => setPhase("pick")}>
              {t("common.cancel")}
            </Button>
          </div>
        </Card>
      )}

      {phase === "details" && intent && network && (
        <>
          <div className="rounded-2xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-950 dark:text-red-100">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
              <p>{t("wallet.cryptoDeposit.bannerStrict")}</p>
            </div>
          </div>

          <Card>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${badgeClass(intent.network)}`}>
                {netLabel(intent.network)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-zinc-800 dark:text-zinc-100">
                USDT
              </span>
            </div>

            <div className="mb-5 space-y-2 rounded-2xl border border-brand-500/25 bg-brand-500/5 p-4 text-sm text-slate-800 dark:text-zinc-200">
              <p className="font-semibold text-slate-900 dark:text-white">{t("wallet.cryptoDeposit.feeTitle")}</p>
              <p>{t("wallet.cryptoDeposit.feePerTx", { fee: intent.serviceFeeUsdt })}</p>
              <p>
                {t("wallet.cryptoDeposit.minOnChainSend", {
                  amount: feeHints?.minSendOnChain ?? String(Number(intent.minAmount) + Number(intent.serviceFeeUsdt)),
                })}
              </p>
              <p className="text-slate-600 dark:text-zinc-400">
                {t("wallet.cryptoDeposit.feeExample", {
                  send: feeHints?.feeExampleSend ?? "",
                  credit: feeHints?.feeExampleCredit ?? "",
                })}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-500">{t("wallet.cryptoDeposit.feeExplainShort")}</p>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
              {t("wallet.cryptoDeposit.depositAddress")}
            </p>
            <div className="mt-2 flex gap-2">
              <code className="flex-1 break-all rounded-xl bg-slate-100 px-3 py-3 font-mono text-xs text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">
                {intent.platformAddress}
              </code>
              <Button type="button" variant="secondary" className="shrink-0 px-3" onClick={() => void copyAddress()}>
                {copied ? <Check className="h-5 w-5 text-emerald-500" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />}
              </Button>
            </div>

            {qrUrl && (
              <div className="mt-5 flex flex-col items-center gap-2">
                <img src={qrUrl} alt={t("wallet.cryptoDeposit.qrAlt")} className="h-44 w-44 rounded-2xl border border-slate-200 bg-white p-2 dark:border-white/10" />
              </div>
            )}

            <div className="mt-5 grid gap-2 text-sm text-slate-600 dark:text-zinc-400">
              <p>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">{t("wallet.cryptoDeposit.confirmations")}:</span>{" "}
                {intent.confirmationsRequired}
              </p>
              {intent.memoTag && (
                <p>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">{t("wallet.cryptoDeposit.memo")}:</span>{" "}
                  {intent.memoTag}
                </p>
              )}
              <p>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">Min credit</span>: {intent.minAmount}{" "}
                USDT · <span className="font-semibold">Min on-chain</span>:{" "}
                {feeHints?.minSendOnChain ?? String(Number(intent.minAmount) + Number(intent.serviceFeeUsdt))} USDT
              </p>
            </div>

            {intent.status === "AWAITING_TX" && !sentClicked && (
              <Button variant="primary" className="mt-6 w-full" type="button" disabled={busy} onClick={() => void onHaveSent()}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("wallet.cryptoDeposit.haveSent")}
              </Button>
            )}

            {(sentClicked || intent.status === "PENDING_VALIDATION") &&
              intent.status !== "CONFIRMED" &&
              intent.status !== "FAILED" && (
              <div className="mt-6 space-y-3 border-t border-slate-200 pt-6 dark:border-white/10">
                <Input
                  label={t("wallet.cryptoDeposit.txidLabel")}
                  value={txid}
                  onChange={(e) => setTxid(e.target.value)}
                  placeholder="0x… / tx hash"
                  autoComplete="off"
                />
                <p className="text-xs text-slate-500 dark:text-zinc-500">{t("wallet.cryptoDeposit.txidHint")}</p>
                <Button variant="primary" className="w-full" type="button" disabled={busy || txid.trim().length < 8} onClick={() => void onSubmitTxid()}>
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("wallet.cryptoDeposit.submitTxid")}
                </Button>
                <Button variant="secondary" className="w-full" type="button" disabled={busy} onClick={() => void onRefresh()}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                  {t("wallet.cryptoDeposit.refresh")}
                </Button>
              </div>
            )}

            {msg && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{msg}</p>}

            {submitOutcome?.status === "PENDING_VALIDATION" && (
              <div className="mt-5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
                <p className="font-semibold">{t("wallet.cryptoDeposit.checking")}</p>
                <p className="mt-2">{t("wallet.cryptoDeposit.pendingNote")}</p>
                {submitOutcome.reason === "INSUFFICIENT_CONFIRMATIONS" &&
                  submitOutcome.confirmations != null &&
                  submitOutcome.required != null && (
                    <p className="mt-2 font-mono text-xs">
                      {submitOutcome.confirmations} / {submitOutcome.required}
                    </p>
                  )}
              </div>
            )}

            {submitOutcome?.status === "FAILED" && (
              <div className="mt-5 flex gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-900 dark:text-red-100">
                <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">{t("wallet.cryptoDeposit.failedTitle")}</p>
                  <p className="mt-1 opacity-90">{submitOutcome.reason}</p>
                </div>
              </div>
            )}

            {(intent.status === "CONFIRMED" || submitOutcome?.status === "CONFIRMED") && (
              <div className="mt-6 flex flex-col items-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center text-emerald-950 dark:text-emerald-100">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-700 dark:text-emerald-300">
                  <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden />
                </div>
                <p className="mt-4 text-lg font-semibold">{t("wallet.cryptoDeposit.successTitle")}</p>
              </div>
            )}
          </Card>
        </>
      )}

      <Link
        href="/app/wallet"
        className="block text-center text-sm font-medium text-brand-600 underline-offset-4 hover:underline dark:text-brand-400"
      >
        {t("wallet.cryptoDeposit.backWallet")}
      </Link>
    </div>
  );
}
