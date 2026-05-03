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

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    username: "",
    country: "CD",
  });
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          ...form,
          email: form.email.trim(),
          username: form.username.trim(),
          fullName: form.fullName.trim(),
        }),
      });
      router.push("/auth/login?registered=1");
    } catch (e: unknown) {
      const aborted =
        (e instanceof Error && e.name === "AbortError") ||
        (typeof e === "object" &&
          e !== null &&
          "name" in e &&
          String((e as { name: unknown }).name) === "AbortError");
      if (aborted) {
        setErr(t("auth.errors.timeout"));
      } else {
        const raw = e instanceof Error ? e.message : "Registration failed";
        setErr(translateAuthApiMessage(raw, t));
      }
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("auth.register.title")}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-500">{t("auth.register.subtitle")}</p>

        <Card className="mt-8">
          <form onSubmit={submit} className="space-y-4">
            {(
              [
                ["fullName", t("auth.register.fullName")],
                ["username", t("auth.register.username")],
                ["email", t("auth.register.email")],
              ] as const
            ).map(([k, label]) => (
              <Input
                key={k}
                label={label}
                required
                type={k === "email" ? "email" : "text"}
                autoComplete={k === "email" ? "email" : k === "username" ? "username" : "name"}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            ))}
            <div className="relative">
              <Input
                label={t("auth.register.password")}
                type={showPw ? "text" : "password"}
                required
                minLength={10}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="pr-12"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-[30px] rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                aria-label={showPw ? t("auth.hidePassword") : t("auth.showPassword")}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Input
              label={t("auth.register.country")}
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase().slice(0, 2) })}
              maxLength={2}
            />
            {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
              {loading ? t("auth.register.loading") : t("auth.register.submit")}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-zinc-500">
          {t("auth.register.hasAccount")}{" "}
          <Link href="/auth/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            {t("auth.register.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
