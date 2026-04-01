"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type Payload = { online: number; totalVisits: number };

type Props = {
  variant?: "nav" | "footer";
};

export default function SiteAudienceBar({ variant = "footer" }: Props) {
  const { t } = useI18n();
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      try {
        const res = await fetch("/api/site-stats", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Payload;
        if (!cancelled && typeof json.online === "number" && typeof json.totalVisits === "number") {
          setData(json);
        }
      } catch {
        /* ignore */
      }
    }

    void pull();
    const id = window.setInterval(pull, 22_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (variant === "nav") {
    if (!data) {
      return (
        <div
          className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5"
          aria-hidden
        >
          <div className="h-3 w-20 animate-pulse rounded bg-zinc-800 sm:w-28" />
        </div>
      );
    }

    return (
      <div
        className={cn(
          "shrink-0 rounded-lg border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-zinc-900/90 px-2.5 py-1.5 shadow-sm shadow-emerald-500/5",
          "max-[360px]:px-2 max-[360px]:py-1",
        )}
        title={t("stats.audienceTitle")}
      >
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2.5">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-zinc-300 sm:text-xs">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {t("stats.onlineApprox")}
            <span className="font-mono font-bold tabular-nums text-emerald-400">{data.online}</span>
          </span>
          <span className="hidden h-3 w-px bg-zinc-700 sm:inline-block" aria-hidden />
          <span className="whitespace-nowrap text-[10px] text-zinc-500 sm:text-xs">
            {t("stats.totalVisits")}{" "}
            <span className="font-mono font-semibold tabular-nums text-zinc-300">
              {data.totalVisits.toLocaleString()}
            </span>
            {t("stats.visitsSuffix")}
          </span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-600" />
          {t("stats.loadingFooter")}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs">
      <span className="inline-flex items-center gap-2 text-zinc-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/40 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {t("stats.onlinePeople", { n: data.online })}
      </span>
      <span className="text-zinc-500">
        {t("stats.cumulativeSite")}
        <span className="font-mono font-medium text-zinc-300">
          {data.totalVisits.toLocaleString()}
        </span>
        {t("stats.cumulativeSuffix")}
      </span>
    </div>
  );
}
