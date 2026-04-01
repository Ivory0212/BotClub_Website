"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export default function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-zinc-800 py-8">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-zinc-600">
        <p>{t("footer.line1")}</p>
        <p className="mt-1">{t("footer.line2")}</p>
        <p className="mx-auto mt-4 max-w-xl text-xs leading-relaxed text-zinc-500">{t("footer.betaNote")}</p>
      </div>
    </footer>
  );
}
