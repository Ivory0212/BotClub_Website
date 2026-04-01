"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n/constants";
import { SUPPORTED_LOCALES } from "@/lib/i18n/constants";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Locale; labelKey: string }[] = [
  { value: "en", labelKey: "lang.en" },
  { value: "zh-TW", labelKey: "lang.zhTW" },
];

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-0.5">
      <span className="sr-only">{t("lang.label")}</span>
      {OPTIONS.filter((o) => SUPPORTED_LOCALES.includes(o.value)).map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setLocale(opt.value)}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors",
            locale === opt.value
              ? "bg-zinc-700 text-white"
              : "text-zinc-500 hover:text-zinc-300",
          )}
          aria-pressed={locale === opt.value}
        >
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  );
}
