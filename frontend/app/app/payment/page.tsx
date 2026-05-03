"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Wallet } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TrustRow } from "@/components/ui/TrustRow";

type Step = "enter" | "wait" | "ok";

export default function PawaPayPaymentPage() {
  const { t } = useI18n();
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("enter");

  function onConfirm() {
    if (!amount.trim()) return;
    setStep("wait");
    setTimeout(() => {
      setStep("ok");
    }, 1800);
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-900 text-brand-400 shadow-card">
          <Wallet className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{t("payment.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-500">{t("payment.subtitle")}</p>
        </div>
      </div>

      <TrustRow escrowLabel={t("home.trustEscrow")} secureLabel={t("home.trustSecure")} />

      {step === "enter" && (
        <Card>
          <Input
            label={t("payment.amount")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
          />
          <Button variant="primary" className="mt-4 w-full" type="button" onClick={onConfirm}>
            {t("payment.confirm")}
          </Button>
        </Card>
      )}

      {step === "wait" && (
        <Card className="flex flex-col items-center py-10 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-brand-500" aria-hidden />
          <p className="mt-4 text-sm font-medium text-slate-800 dark:text-zinc-200">{t("payment.waiting")}</p>
        </Card>
      )}

      {step === "ok" && (
        <Card className="flex flex-col items-center py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{t("payment.success")}</p>
          <Link
            href="/app/dashboard"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-900/30"
          >
            {t("payment.backHub")}
          </Link>
        </Card>
      )}

      <p className="text-center text-[11px] text-slate-500 dark:text-zinc-600">{t("payment.demoNote")}</p>
    </div>
  );
}
