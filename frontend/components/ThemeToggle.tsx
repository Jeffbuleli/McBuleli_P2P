"use client";

import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? t("shell.themeLight") : t("shell.themeDark")}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-700 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-earth-950 dark:text-zinc-200 dark:hover:bg-earth-900 ${className}`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
