"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";

type Me = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string | null;
  country: string;
  kycStatus: string;
  profilePhotoUrl: string | null;
  p2pRatingAvg: string | number;
  completedTrades: number;
  createdAt: string;
  emailVerifiedAt: string | null;
  twoFactorEnabled: boolean;
};

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  useEffect(() => {
    api<Me>("/api/users/me")
      .then((u) => {
        setMe(u);
        setFullName(u.fullName);
        setPhone(u.phone ?? "");
        setPhotoUrl(u.profilePhotoUrl ?? "");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Error"));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await api<{ fullName: string; phone: string | null; profilePhotoUrl: string | null }>(
        "/api/users/me",
        {
          method: "PATCH",
          body: JSON.stringify({
            fullName: fullName.trim(),
            phone: phone.trim() || undefined,
            profilePhotoUrl: photoUrl.trim() || undefined,
          }),
        },
      );
      setMsg(t("profile.saved"));
      const u = await api<Me>("/api/users/me");
      setMe(u);
      setFullName(u.fullName);
      setPhone(u.phone ?? "");
      setPhotoUrl(u.profilePhotoUrl ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (err === "UNAUTHORIZED" || err === "INVALID_TOKEN") {
    return (
      <div className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-400">
        <Link href="/auth/login" className="text-brand-400">
          {t("profile.signIn")}
        </Link>
      </div>
    );
  }

  if (err && err !== "UNAUTHORIZED" && err !== "INVALID_TOKEN") {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">{err}</div>
    );
  }

  if (!me) return <p className="text-sm text-zinc-500">{t("profile.loading")}</p>;

  const safePhoto =
    photoUrl.trim().startsWith("https://") ? photoUrl.trim() : me.profilePhotoUrl?.startsWith("https://") ? me.profilePhotoUrl : null;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">{t("profile.title")}</h1>
        <p className="mt-1 text-sm text-earth-500">{t("profile.subtitle")}</p>
      </div>

      {msg && (
        <div className="rounded-xl border border-brand-900/40 bg-brand-950/25 px-4 py-2 text-sm text-brand-100">{msg}</div>
      )}
      {err && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200">{err}</div>
      )}

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-earth-800 bg-earth-950">
          {safePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={safePhoto} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-earth-600">
              {me.username.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <Link
          href={`/app/u/${encodeURIComponent(me.username)}`}
          className="text-sm text-brand-400 hover:underline"
        >
          {t("profile.publicLink")}
        </Link>
      </div>

      <section className="rounded-2xl border border-earth-800/80 bg-earth-950/20 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-earth-500">{t("profile.readOnly")}</p>
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-earth-900/60 pb-2">
            <dt className="text-earth-500">{t("profile.email")}</dt>
            <dd className="text-right text-earth-100">{me.email}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-earth-900/60 pb-2">
            <dt className="text-earth-500">{t("profile.username")}</dt>
            <dd className="font-mono text-earth-100">{me.username}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-earth-900/60 pb-2">
            <dt className="text-earth-500">{t("profile.country")}</dt>
            <dd className="text-earth-100">{me.country}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-earth-900/60 pb-2">
            <dt className="text-earth-500">{t("profile.kyc")}</dt>
            <dd className="capitalize text-earth-100">{me.kycStatus.toLowerCase()}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-earth-900/60 pb-2">
            <dt className="text-earth-500">{t("profile.rating")}</dt>
            <dd className="text-earth-100">{Number(me.p2pRatingAvg).toFixed(1)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-earth-900/60 pb-2">
            <dt className="text-earth-500">{t("profile.trades")}</dt>
            <dd className="text-earth-100">{me.completedTrades}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-earth-900/60 pb-2">
            <dt className="text-earth-500">{t("profile.memberSince")}</dt>
            <dd className="text-earth-100">
              {new Date(me.createdAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
            </dd>
          </div>
          <div className="flex justify-between gap-4 pb-1">
            <dt className="text-earth-500">{t("profile.verifyEmailShort")}</dt>
            <dd className="text-earth-100">
              {me.emailVerifiedAt ? t("profile.statusVerified") : t("profile.emailNotVerified")}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-earth-500">2FA</dt>
            <dd className="text-earth-100">{me.twoFactorEnabled ? t("profile.twofaOn") : t("profile.twofaOff")}</dd>
          </div>
        </dl>
      </section>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-earth-800/80 p-4">
        <label className="block">
          <span className="text-xs text-earth-500">{t("profile.fullName")}</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-earth-800 bg-earth-950/60 px-3 py-2 text-sm text-white"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="text-xs text-earth-500">{t("profile.phone")}</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-xl border border-earth-800 bg-earth-950/60 px-3 py-2 text-sm text-white"
            autoComplete="tel"
          />
        </label>
        <label className="block">
          <span className="text-xs text-earth-500">{t("profile.photoUrl")}</span>
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1 w-full rounded-xl border border-earth-800 bg-earth-950/60 px-3 py-2 font-mono text-sm text-white placeholder:text-earth-600"
          />
          <span className="mt-1 block text-xs text-earth-600">{t("profile.photoHint")}</span>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? t("common.loading") : t("profile.save")}
        </button>
      </form>
    </div>
  );
}
