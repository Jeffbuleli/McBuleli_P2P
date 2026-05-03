"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, Send } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";

type WalletRow = {
  id: string;
  kind: string;
  currencyCode: string;
  balance: string;
  lockedBalance: string;
};

export default function WalletPage() {
  const { t } = useI18n();
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
      setMsg(t("wallet.transferDone"));
      setTo("");
      setAmount("");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : t("wallet.failed"));
    }
  }

  if (!rows) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("wallet.title")}</h1>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link
            href="/app/payment"
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-3 text-center text-xs font-semibold text-slate-800 shadow-sm dark:border-white/10 dark:bg-surface-secondary/80 dark:text-zinc-100"
          >
            <ArrowDownCircle className="h-6 w-6 text-brand-500" aria-hidden />
            {t("wallet.quickMoMoDeposit")}
          </Link>
          <Link
            href="/app/wallet/crypto/deposit"
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-3 text-center text-xs font-semibold text-slate-800 shadow-sm dark:border-white/10 dark:bg-surface-secondary/80 dark:text-zinc-100"
          >
            <ArrowDownCircle className="h-6 w-6 text-emerald-500" aria-hidden />
            {t("wallet.quickCryptoDeposit")}
          </Link>
          <Link
            href="/app/wallet/crypto/withdraw"
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-3 text-center text-xs font-semibold text-slate-800 shadow-sm dark:border-white/10 dark:bg-surface-secondary/80 dark:text-zinc-100"
          >
            <ArrowUpCircle className="h-6 w-6 text-amber-500" aria-hidden />
            {t("wallet.quickCryptoWithdraw")}
          </Link>
          <Link
            href="#wallet-internal-transfer"
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-3 text-center text-xs font-semibold text-slate-800 shadow-sm dark:border-white/10 dark:bg-surface-secondary/80 dark:text-zinc-100"
          >
            <Send className="h-6 w-6 text-brand-500" aria-hidden />
            {t("dashboard.send")}
          </Link>
        </div>
      </div>

      <ul className="space-y-3">
        {rows.map((w) => (
          <li key={w.id}>
            <Card className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {w.currencyCode}{" "}
                  <span className="text-xs font-normal text-slate-500 dark:text-zinc-500">({w.kind})</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-500">
                  {t("wallet.locked")}: {w.lockedBalance}
                </p>
              </div>
              <p className="font-mono text-lg tabular-nums text-brand-600 dark:text-brand-300">{w.balance}</p>
            </Card>
          </li>
        ))}
      </ul>

      <Card id="wallet-internal-transfer">
        <CardHeader title={t("wallet.internalTransfer")} />
        <form onSubmit={transfer} className="space-y-4">
          <Input
            placeholder={t("wallet.recipientPlaceholder")}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            autoComplete="off"
          />
          <div className="flex gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "FIAT" | "CRYPTO")}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-white/10 dark:bg-zinc-950/80 dark:text-zinc-100"
            >
              <option value="FIAT">{t("wallet.fiatOption")}</option>
              <option value="CRYPTO">{t("wallet.cryptoOption")}</option>
            </select>
            <select
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-white/10 dark:bg-zinc-950/80 dark:text-zinc-100"
            >
              <option value="CDF">CDF</option>
              <option value="USD">USD</option>
              <option value="USDT">USDT</option>
            </select>
          </div>
          <Input
            placeholder={t("wallet.amountPlaceholder")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />
          {msg && (
            <p className={`text-sm ${msg.includes("fail") || msg.includes("Error") || msg.includes("INSUFFICIENT") ? "text-red-600 dark:text-red-400" : "text-brand-600 dark:text-brand-300"}`}>
              {msg}
            </p>
          )}
          <Button type="submit" variant="primary" size="md" className="w-full">
            {t("common.send")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
