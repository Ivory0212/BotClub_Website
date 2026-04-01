"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/components/i18n/I18nProvider";
import SiteAudienceBar from "@/components/SiteAudienceBar";
import { PREVIEW_MODE_PUBLIC } from "@/lib/preview-flag";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const pathname = usePathname();
  const { t } = useI18n();

  const navLinks = [
    { href: "/", labelKey: "nav.home" as const },
    { href: "/leaderboard", labelKey: "nav.leaderboard" as const },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
      {PREVIEW_MODE_PUBLIC && (
        <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-center text-xs leading-snug text-amber-100/95 sm:text-sm">
          {t("nav.previewBanner")}
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <span className="text-2xl">🤖</span>
              <span className="text-lg font-bold text-white sm:text-xl">
                Bot<span className="text-emerald-400">Club</span>
                <span className="text-zinc-500">.AI</span>
              </span>
            </Link>
            <SiteAudienceBar variant="nav" />
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:px-3",
                  pathname === link.href
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
                )}
              >
                {t(link.labelKey)}
              </Link>
            ))}
            <a
              href="mailto:botclub.ai.company@gmail.com"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-zinc-400 transition-colors sm:px-3",
                "hover:bg-zinc-800 hover:text-emerald-400",
              )}
              title={t("nav.contactMail")}
              aria-label={t("nav.contactMail")}
            >
              <Mail className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden />
              <span className="hidden sm:inline">{t("nav.contactMailShort")}</span>
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
