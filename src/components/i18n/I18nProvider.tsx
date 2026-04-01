"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/constants";
import { messagesByLocale } from "@/lib/i18n/messages";
import { localeToHtmlLang } from "@/lib/i18n/parse-locale";
import { translate } from "@/lib/i18n/translate";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = localeToHtmlLang(next);
      document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = localeToHtmlLang(locale);
  }, [locale]);

  const dict = messagesByLocale[locale];

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(dict, key, vars),
    [dict],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
