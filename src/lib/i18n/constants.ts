export const LOCALE_COOKIE = "botclub-locale";

export const SUPPORTED_LOCALES = ["en", "zh-TW"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
