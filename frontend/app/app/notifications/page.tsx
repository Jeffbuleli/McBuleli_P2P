"use client";

import { Bell } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Card } from "@/components/ui/Card";

const DEMO = [
  { id: "1", titleKey: "notifications.sampleTrade" as const },
  { id: "2", titleKey: "notifications.samplePay" as const },
  { id: "3", titleKey: "notifications.sampleSecurity" as const },
];

export default function NotificationsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-900 text-brand-400 shadow-card dark:bg-primary-950">
          <Bell className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t("notifications.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-500">{t("notifications.subtitle")}</p>
        </div>
      </div>

      <p className="text-xs text-slate-600 dark:text-zinc-400">{t("notifications.empty")}</p>

      <ul className="space-y-3">
        {DEMO.map((n) => (
          <li key={n.id}>
            <Card className="py-3">
              <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{t(n.titleKey)}</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500">McBuleli · demo</p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
