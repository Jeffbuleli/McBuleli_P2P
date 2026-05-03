"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { User } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

type MeLite = {
  username: string;
  profilePhotoUrl: string | null;
};

const MD_MIN = 768;

export function UserMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<MeLite | null | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const [wide, setWide] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<MeLite>("/api/users/me")
      .then((u) => setMe({ username: u.username, profilePhotoUrl: u.profilePhotoUrl }))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MD_MIN}px)`);
    setWide(mq.matches);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MD_MIN}px)`);
    function sync() {
      setWide(mq.matches);
    }
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 8;
      setDropdownPos({
        top: r.bottom + gap,
        right: Math.max(12, window.innerWidth - r.right),
      });
    }

    place();
    const ro = new ResizeObserver(place);
    ro.observe(document.documentElement);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  const photo =
    me?.profilePhotoUrl?.startsWith("https://") ? me.profilePhotoUrl : null;
  const initials = me?.username?.slice(0, 2).toUpperCase() ?? "";

  const layer =
    open && mounted ? (
      <>
        <button
          type="button"
          aria-label={t("common.cancel")}
          className="fixed inset-0 z-[280] touch-none bg-black/50"
          onPointerDown={() => setOpen(false)}
        />

        {wide ? (
          <div
            ref={sheetRef}
            role="menu"
            className="fixed z-[290] flex max-h-[min(80vh,520px)] w-[min(92vw,300px)] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-card-lg dark:border-white/[0.12] dark:bg-surface-secondary dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            style={{ top: dropdownPos.top, right: dropdownPos.right }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MenuBody onClose={() => setOpen(false)} wide />
          </div>
        ) : (
          <div
            ref={sheetRef}
            role="menu"
            className="user-menu-sheet-mobile fixed inset-x-0 bottom-0 z-[290] flex max-h-[min(55vh,480px)] min-h-[min(42vh,320px)] flex-col overflow-hidden rounded-t-2xl border border-slate-200/90 bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-card-lg dark:border-white/[0.12] dark:bg-surface-secondary dark:shadow-[0_-8px_32px_rgba(0,0,0,0.5)]"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MenuBody onClose={() => setOpen(false)} wide={false} />
          </div>
        )}
      </>
    ) : null;

  return (
    <div className="relative z-[50]">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none ring-brand-500/40 transition hover:border-brand-500/30 hover:bg-slate-50 focus-visible:ring-2 dark:border-white/10 dark:bg-earth-950 dark:text-earth-200 dark:hover:border-brand-500/30 dark:hover:bg-earth-900 ${
          open ? "relative z-[320]" : ""
        }`}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : me === undefined ? (
          <span className="h-3 w-3 animate-pulse rounded-full bg-earth-700" aria-hidden />
        ) : me ? (
          <span aria-hidden>{initials}</span>
        ) : (
          <User className="h-4 w-4 opacity-80" aria-hidden />
        )}
      </button>

      {mounted && layer ? createPortal(layer, document.body) : null}
    </div>
  );
}

function MenuBody({ onClose, wide }: { onClose: () => void; wide: boolean }) {
  const { t } = useI18n();
  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-white/[0.08]">
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] px-1 text-sm font-medium text-brand-400 hover:text-brand-300 touch-manipulation [-webkit-tap-highlight-color:transparent]"
          onClick={onClose}
        >
          ← {t("shell.menuBack")}
        </button>
      </div>

      <div
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 ${
          wide ? "" : "pb-1"
        }`}
      >
        <Link
          role="menuitem"
          href="/app/profile"
          className="block min-h-[44px] px-4 py-3 text-sm text-slate-900 hover:bg-slate-50 touch-manipulation dark:text-zinc-100 dark:hover:bg-surface-tertiary"
          onClick={onClose}
        >
          {t("shell.menuProfile")}
        </Link>
        <div className="mx-3 border-t border-slate-100 px-1 pt-4 pb-2 dark:border-white/[0.08]">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-500">
            {t("common.language")}
          </p>
          <LanguageSwitcher className="justify-center sm:justify-start" />
        </div>
      </div>
    </>
  );
}
