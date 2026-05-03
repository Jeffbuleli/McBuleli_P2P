"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Row = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsPage() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const localeTag = locale === "fr" ? "fr-FR" : "en-US";

  const load = useCallback(() => {
    setErr(null);
    api<Row[]>("/api/p2p/notifications")
      .then(setRows)
      .catch((e: unknown) => {
        setErr(e instanceof Error ? e.message : "Error");
        setRows([]);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    await api(`/api/p2p/notifications/${id}/read`, { method: "POST", body: JSON.stringify({}) });
    load();
  }

  async function markAllRead() {
    await api("/api/p2p/notifications/read-all", { method: "POST", body: JSON.stringify({}) });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-900 text-brand-400 shadow-card dark:bg-primary-950">
            <Bell className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("notifications.title")}</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-500">{t("notifications.subtitle")}</p>
          </div>
        </div>
        {rows && rows.some((r) => !r.readAt) && (
          <Button type="button" variant="outline" size="sm" onClick={() => markAllRead().catch(console.error)}>
            {t("notifications.markAllRead")}
          </Button>
        )}
      </div>

      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

      {!rows && <p className="text-sm text-slate-500 dark:text-zinc-500">{t("common.loading")}</p>}

      {rows && rows.length === 0 && !err && (
        <p className="text-xs text-slate-600 dark:text-zinc-400">{t("notifications.emptyLive")}</p>
      )}

      <ul className="space-y-3">
        {rows?.map((n) => (
          <li key={n.id}>
            <Card className={`py-3 ${n.readAt ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{n.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">{n.body}</p>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-500">
                    McBuleli · {new Date(n.createdAt).toLocaleString(localeTag)}
                  </p>
                </div>
                {!n.readAt && (
                  <Button type="button" variant="outline" size="sm" onClick={() => markRead(n.id)}>
                    {t("notifications.markRead")}
                  </Button>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
