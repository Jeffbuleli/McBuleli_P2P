"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import { getNestedString } from "@/lib/i18n/nested";

export type Locale = "en" | "fr";

const STORAGE_KEY = "mcbuleli-locale";

const messages = { en, fr } as const;

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Traduction par clé pointée ; `{var}` dans la chaîne si `vars` fourni */
  t: (key: string, vars?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars: Record<string, string>): string {
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll(`{${k}}`, v);
  }
  return s;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === "fr" || stored === "en") {
      setLocaleState(stored);
    } else {
      const nav = navigator.language.toLowerCase();
      setLocaleState(nav.startsWith("fr") ? "fr" : "en");
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      const raw = getNestedString(messages[locale], key);
      const fallback = getNestedString(messages.en, key);
      const template = raw ?? fallback ?? key;
      return vars ? interpolate(template, vars) : template;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
