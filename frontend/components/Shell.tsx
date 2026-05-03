"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Bell, LayoutDashboard, TrendingUp, Wallet } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

const navItems = [
  { href: "/app/dashboard", labelKey: "shell.navHome" as const, Icon: LayoutDashboard },
  { href: "/app/wallet", labelKey: "shell.navWallet" as const, Icon: Wallet },
  { href: "/app/p2p", labelKey: "shell.navP2p" as const, Icon: ArrowLeftRight },
  { href: "/app/staking", labelKey: "shell.navStake" as const, Icon: TrendingUp },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const bellActive = pathname.startsWith("/app/notifications");

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="safe-pt sticky top-0 z-40 border-b border-slate-200/90 bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/[0.08] dark:bg-surface-secondary/95 dark:shadow-[0_1px_2px_rgba(0,0,0,0.24)]">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 pb-3 md:max-w-5xl">
          <Link
            href="/app/dashboard"
            className="bg-gradient-to-r from-primary-800 via-brand-600 to-brand-500 bg-clip-text text-lg font-bold tracking-tight text-transparent dark:from-brand-400 dark:to-earth-400"
          >
            {t("shell.brand")}
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/app/notifications"
              aria-label={t("shell.notifications")}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition sm:h-10 sm:w-10 ${
                bellActive
                  ? "border-brand-500/40 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                  : "border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-earth-950 dark:text-zinc-200 dark:hover:bg-earth-900"
              }`}
            >
              <Bell className="h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5" strokeWidth={bellActive ? 2.25 : 1.75} aria-hidden />
            </Link>
            <ThemeToggle />
            <UserMenu />
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map(({ href, labelKey, Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 rounded-[12px] px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-surface-tertiary dark:hover:text-zinc-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    <span>{t(labelKey)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 md:max-w-5xl">{children}</main>
      <nav className="safe-pb fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200/90 bg-white/98 pt-1 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/[0.08] dark:bg-surface-secondary/98 dark:shadow-[0_-4px_12px_rgba(0,0,0,0.2)] md:hidden">
        {navItems.map(({ href, labelKey, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 ${
                active ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-zinc-500"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
              <span className="max-w-[4.5rem] truncate text-[10px] font-medium leading-none">
                {t(labelKey)}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
