"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";

type PublicUser = {
  id: string;
  username: string;
  p2pRatingAvg: string | number;
  completedTrades: number;
  createdAt: string;
  country: string;
};

export default function PublicUserProfilePage() {
  const params = useParams();
  const raw = params.username;
  const username = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const { t, locale } = useI18n();
  const [u, setU] = useState<PublicUser | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    setErr(null);
    api<PublicUser>(`/api/users/${encodeURIComponent(username)}/public`, { auth: false })
      .then(setU)
      .catch((e) => setErr(e instanceof Error ? e.message : "NOT_FOUND"));
  }, [username]);

  if (!username) {
    return <p className="text-sm text-zinc-500">{t("profile.notFound")}</p>;
  }

  if (err === "NOT_FOUND") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <p className="text-sm text-red-300">{t("profile.notFound")}</p>
        <Link href="/app/dashboard" className="text-sm text-brand-400 hover:underline">
          {t("profile.backHub")}
        </Link>
      </div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
        {err}
      </div>
    );
  }

  if (!u) return <p className="text-sm text-zinc-500">{t("profile.loading")}</p>;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">@{u.username}</h1>
        <p className="mt-1 text-sm text-earth-500">{t("profile.publicSubtitle")}</p>
      </div>

      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-earth-800 bg-earth-950 text-2xl font-semibold text-earth-500">
        {u.username.slice(0, 2).toUpperCase()}
      </div>

      <dl className="rounded-2xl border border-earth-800/80 bg-earth-950/20 p-4 text-sm">
        <div className="flex justify-between gap-4 border-b border-earth-900/60 py-2">
          <dt className="text-earth-500">{t("profile.country")}</dt>
          <dd className="text-earth-100">{u.country}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-earth-900/60 py-2">
          <dt className="text-earth-500">{t("profile.rating")}</dt>
          <dd className="text-earth-100">{Number(u.p2pRatingAvg).toFixed(1)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-earth-900/60 py-2">
          <dt className="text-earth-500">{t("profile.trades")}</dt>
          <dd className="text-earth-100">{u.completedTrades}</dd>
        </div>
        <div className="flex justify-between gap-4 pt-2">
          <dt className="text-earth-500">{t("profile.memberSince")}</dt>
          <dd className="text-earth-100">
            {new Date(u.createdAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
          </dd>
        </div>
      </dl>

      <Link href="/app/dashboard" className="inline-block text-sm text-brand-400 hover:underline">
        ← {t("profile.backHub")}
      </Link>
    </div>
  );
}
