"use client";

import { useI18n } from "@/components/I18nProvider";

/** Compact FR | EN — réutilisable dans le header ou la landing */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className={`flex items-center gap-1 text-xs ${className}`}>
      <span className="sr-only">{t("common.language")}</span>
      <button
        type="button"
        onClick={() => setLocale("fr")}
        className={
          locale === "fr"
            ? "rounded px-2 py-1 font-semibold text-brand-600 dark:text-brand-400"
            : "rounded px-2 py-1 text-slate-500 hover:text-slate-800 dark:text-zinc-500 dark:hover:text-zinc-300"
        }
        aria-pressed={locale === "fr"}
      >
        FR
      </button>
      <span className="text-slate-300 dark:text-zinc-600">|</span>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={
          locale === "en"
            ? "rounded px-2 py-1 font-semibold text-brand-600 dark:text-brand-400"
            : "rounded px-2 py-1 text-slate-500 hover:text-slate-800 dark:text-zinc-500 dark:hover:text-zinc-300"
        }
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}
