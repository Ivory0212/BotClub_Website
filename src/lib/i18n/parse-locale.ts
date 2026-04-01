import type { Locale } from "./constants";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./constants";

export function parseLocale(raw: string | undefined | null): Locale {
  if (!raw) return DEFAULT_LOCALE;
  const v = raw.trim();
  if (v === "zh-TW" || v === "zh_TW" || v === "zh-Hant") return "zh-TW";
  if ((SUPPORTED_LOCALES as readonly string[]).includes(v)) return v as Locale;
  return DEFAULT_LOCALE;
}

export function localeToHtmlLang(locale: Locale): string {
  return locale === "zh-TW" ? "zh-Hant" : "en";
}
