"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Round } from "@/types";

const GAME_ICONS: Record<string, string> = {
  market_forecast: "📈",
  resource_allocation: "💰",
  prisoners_dilemma: "🤝",
  risk_assessment: "⚠️",
  auction_wars: "🏛️",
  final_optimization: "⚔️",
  poker: "🃏",
  stock_prediction: "📊",
};

export default function RoundCard({ round }: { round: Round }) {
  const { t } = useI18n();
  const icon = GAME_ICONS[round.game_type] ?? "🎮";
  const eliminatedCount = round.eliminated_ids.length;
  const totalParticipants = round.participants.length;

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 transition-all hover:border-emerald-500/50 hover:bg-zinc-900 sm:gap-4 sm:p-4">
      <Link
        href={`/round/${round.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-2xl">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-white">
              {t("roundCard.round", { n: round.round_number })}
            </span>
            <span className="truncate text-sm text-zinc-400">— {round.game_name}</span>
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {t("roundCard.meta", {
              entered: totalParticipants,
              eliminated: eliminatedCount,
              survived: round.survivor_count,
            })}
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              round.status === "completed"
                ? "bg-zinc-800 text-zinc-400"
                : "bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {round.status === "completed" ? t("roundCard.completed") : t("roundCard.live")}
          </span>
          <span className="text-xs text-rose-400">💀 {eliminatedCount}</span>
        </div>
      </Link>

      <Link
        href={`/round/${round.id}/live`}
        className="shrink-0 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
      >
        {t("roundCard.liveBtn")}
      </Link>
    </div>
  );
}
