"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Loader2 } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Net = "TRC20" | "ERC20" | "BEP20";

type SupportedResp = {
  minWithdraw: string;
  serviceFeeUsdt: string;
  networks: Record<Net, { enabled: boolean }>;
};

type WithdrawRow = {
  id: string;
  referenceId: string;
  status: string;
  network: Net;
  toAddress: string;
  amount: string;
  feeAmount: string;
  txid: string | null;
};

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

export default function CryptoWithdrawPage() {
  const { t } = useI18n();
  const [supported, setSupported] = useState<SupportedResp | null>(null);
  const [network, setNetwork] = useState<Net | null>(null);
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<string>("0");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<WithdrawRow | null>(null);

  const netLabel = (n: Net) =>
    n === "TRC20"
      ? t("wallet.cryptoDeposit.networkTrc20")
      : n === "ERC20"
        ? t("wallet.cryptoDeposit.networkErc20")
        : t("wallet.cryptoDeposit.networkBep20");

  useEffect(() => {
    api<SupportedResp>("/api/wallet/crypto/supported")
      .then(setSupported)
      .catch(() => setSupported(null));
  }, []);

  useEffect(() => {
    api<Array<{ kind: string; currencyCode: string; balance: string }>>("/api/wallet/balances")
      .then((rows) => {
        const usdt = rows.find((r) => r.kind === "CRYPTO" && r.currencyCode === "USDT");
        if (usdt) setBalance(usdt.balance);
      })
      .catch(() => setBalance("0"));
  }, []);

  const feeStr = supported?.serviceFeeUsdt ?? "2";

  const amountOk = /^\d+(\.\d+)?$/.test(amount.trim()) && parseFloat(amount) > 0;
  const addressOk = address.trim().length >= 10;

  const totalDeductStr = useMemo(() => {
    if (!amountOk) return "";
    const net = parseFloat(amount.trim());
    const fee = parseFloat(feeStr);
    if (Number.isNaN(net) || Number.isNaN(fee)) return "";
    return (net + fee).toFixed(8).replace(/\.?0+$/, "").replace(/\.$/, "");
  }, [amount, amountOk, feeStr]);

  const sufficientBalance = useMemo(() => {
    if (!amountOk || !totalDeductStr) return true;
    const bal = parseFloat(balance);
    const need = parseFloat(totalDeductStr);
    if (Number.isNaN(bal) || Number.isNaN(need)) return true;
    return bal >= need - 1e-10;
  }, [amountOk, balance, totalDeductStr]);

  const canReview = useMemo(() => {
    return Boolean(
      network &&
        amountOk &&
        addressOk &&
        sufficientBalance &&
        supported?.networks[network!]?.enabled,
    );
  }, [network, amountOk, addressOk, sufficientBalance, supported]);

  async function submit() {
    if (!network || !canReview) return;
    setBusy(true);
    setMsg(null);
    try {
      const row = await api<WithdrawRow>("/api/wallet/crypto/withdraw", {
        method: "POST",
        body: JSON.stringify({
          network,
          toAddress: address.trim(),
          amount: amount.trim(),
        }),
      });
      setModal(false);
      setDone(row);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : t("wallet.failed"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg space-y-6 pb-10">
        <div className="flex flex-col items-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-center text-emerald-950 dark:text-emerald-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/25 text-emerald-700 dark:text-emerald-300">
            <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden />
          </div>
          <p className="mt-4 text-lg font-semibold">{t("wallet.cryptoWithdraw.successTitle")}</p>
          <p className="mt-2 text-sm opacity-90">{t("wallet.cryptoWithdraw.successNote")}</p>
          <p className="mt-3 text-sm opacity-90">
            {t("wallet.cryptoWithdraw.youReceive")}: {done.amount} USDT · {t("wallet.cryptoWithdraw.serviceFee")}:{" "}
            {done.feeAmount} USDT
          </p>
          {done.txid && (
            <p className="mt-4 font-mono text-xs break-all opacity-80">
              TXID: {done.txid}
            </p>
          )}
        </div>
        <Link
          href="/app/wallet"
          className="block text-center text-sm font-medium text-brand-600 underline-offset-4 hover:underline dark:text-brand-400"
        >
          {t("wallet.cryptoWithdraw.backWallet")}
        </Link>
      </div>
    );
  }

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
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{t("wallet.cryptoWithdraw.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-500">{t("wallet.cryptoWithdraw.subtitle")}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-950 dark:text-red-100">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          <p>{t("wallet.cryptoWithdraw.riskBanner")}</p>
        </div>
      </div>

      <Card>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
          {t("wallet.cryptoDeposit.networkTitle")}
        </p>
        <div className="grid gap-3">
          {(["TRC20", "ERC20", "BEP20"] as const).map((n) => {
            const on = supported?.networks[n]?.enabled ?? false;
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
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between text-sm text-slate-600 dark:text-zinc-400">
          <span>
            {t("wallet.cryptoWithdraw.available")}:{" "}
            <span className="font-mono font-semibold text-slate-900 dark:text-white">{balance} USDT</span>
          </span>
          <button
            type="button"
            className="font-semibold text-brand-600 underline-offset-4 hover:underline dark:text-brand-400"
            onClick={() => setAmount(balance)}
          >
            {t("wallet.cryptoWithdraw.max")}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <Input
            label={t("wallet.cryptoWithdraw.destination")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="off"
            placeholder={network === "TRC20" ? "T…" : "0x…"}
          />
          <Input
            label={t("wallet.cryptoWithdraw.amount")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
          />
          {amountOk && totalDeductStr && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-300">
              <p>
                {t("wallet.cryptoWithdraw.serviceFee")}: {feeStr} USDT
              </p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                {t("wallet.cryptoWithdraw.totalDeduct")}: {totalDeductStr} USDT
              </p>
              {!sufficientBalance && (
                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{t("wallet.cryptoWithdraw.insufficientBalance")}</p>
              )}
            </div>
          )}
        </div>

        {msg && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{msg}</p>}

        <Button
          variant="primary"
          className="mt-6 w-full"
          type="button"
          disabled={!canReview || busy}
          onClick={() => setModal(true)}
        >
          {t("wallet.cryptoWithdraw.review")}
        </Button>
      </Card>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t("wallet.cryptoWithdraw.modalTitle")}</h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400">
              {t("wallet.cryptoWithdraw.youReceive")}: {amount.trim()} USDT · {t("wallet.cryptoWithdraw.serviceFee")}: {feeStr}{" "}
              USDT
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {t("wallet.cryptoWithdraw.totalDeduct")}: {totalDeductStr} USDT
            </p>
            <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400">
              {t("wallet.cryptoWithdraw.modalBody", {
                amount: amount.trim(),
                network: network ? netLabel(network) : "",
              })}
            </p>
            <code className="mt-3 block break-all rounded-xl bg-slate-100 px-3 py-3 font-mono text-xs text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">
              {address.trim()}
            </code>
            <div className="mt-6 flex gap-2">
              <Button variant="ghost" className="flex-1" type="button" onClick={() => setModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" className="flex-1" type="button" disabled={busy} onClick={() => void submit()}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t("wallet.cryptoWithdraw.confirmSend")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Link
        href="/app/wallet"
        className="block text-center text-sm font-medium text-brand-600 underline-offset-4 hover:underline dark:text-brand-400"
      >
        {t("wallet.cryptoWithdraw.backWallet")}
      </Link>
    </div>
  );
}
