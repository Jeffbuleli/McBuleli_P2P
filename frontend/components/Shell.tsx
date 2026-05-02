"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/app/dashboard", label: "Home" },
  { href: "/app/wallet", label: "Wallet" },
  { href: "/app/p2p", label: "P2P" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="pb-24 md:pb-8 min-h-screen">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3 md:max-w-5xl">
          <Link href="/app/dashboard" className="text-lg font-semibold tracking-tight text-brand-400">
            McBuleli P2P
          </Link>
          <nav className="hidden gap-4 text-sm md:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={
                  pathname === n.href ? "text-brand-300" : "text-zinc-400 hover:text-zinc-200"
                }
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 md:max-w-5xl">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-zinc-800 bg-zinc-950/95 pt-2 pb-4 md:hidden">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex-1 py-3 text-center text-xs font-medium ${
              pathname === n.href ? "text-brand-400" : "text-zinc-500"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
