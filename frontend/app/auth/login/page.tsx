"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { translateAuthApiMessage } from "@/lib/i18n/translate-api";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await api<{
        accessToken: string;
        refreshToken: string;
      }>("/api/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(needs2fa || code ? { twoFactorCode: code } : {}),
        }),
      });
      localStorage.setItem("accessToken", res.accessToken);
      localStorage.setItem("refreshToken", res.refreshToken);
      router.push("/app/dashboard");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login failed";
      if (msg.includes("2FA")) setNeeds2fa(true);
      setErr(translateAuthApiMessage(msg, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-16 text-slate-900 dark:from-[#0b0d12] dark:to-[#0d0d0f] dark:text-zinc-100">
      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("auth.login.title")}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-500">{t("auth.login.subtitle")}</p>

        <Card className="mt-8">
          <form onSubmit={submit} className="space-y-4">
            <Input
              label={t("auth.login.email")}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="relative">
              <Input
                label={t("auth.login.password")}
                type={showPw ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-12"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-[30px] rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label={showPw ? t("auth.hidePassword") : t("auth.showPassword")}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {(needs2fa || code) && (
              <Input
                label={t("auth.login.twofa")}
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("auth.login.twofaPlaceholder")}
              />
            )}
            {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
              {loading ? t("auth.login.loading") : t("common.continue")}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-zinc-500">
          {t("auth.login.noAccount")}{" "}
          <Link href="/auth/register" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            {t("auth.login.registerLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
