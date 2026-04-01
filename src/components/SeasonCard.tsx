"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Season } from "@/types";

export default function SeasonCard({ season }: { season: Season }) {
  const { t } = useI18n();
  const statusColors = {
    upcoming: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    completed: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30",
  };

  const statusLabel =
    season.status === "upcoming"
      ? t("seasonCard.upcoming")
      : season.status === "active"
        ? t("seasonCard.active")
        : t("seasonCard.completed");

  return (
    <Link
      href={`/season/${season.id}`}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-all hover:border-emerald-500/50 hover:bg-zinc-900"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{t("seasonCard.season", { n: season.number })}</h3>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColors[season.status]}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-lg font-bold text-white">{season.total_bots}</div>
          <div className="text-xs text-zinc-500">{t("seasonCard.started")}</div>
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-400">{season.alive_bots}</div>
          <div className="text-xs text-zinc-500">{t("seasonCard.alive")}</div>
        </div>
        <div>
          <div className="text-lg font-bold text-amber-400">
            {season.current_round}/{season.total_rounds}
          </div>
          <div className="text-xs text-zinc-500">{t("seasonCard.rounds")}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 rounded-full bg-zinc-800">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all"
            style={{
              width: `${season.total_rounds > 0 ? (season.current_round / season.total_rounds) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {season.champion && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
          <span>👑</span>
          <span className="text-sm font-medium text-amber-400">
            {t("seasonCard.champion", {
              emoji: season.champion.avatar_emoji,
              name: season.champion.name,
            })}
          </span>
        </div>
      )}
    </Link>
  );
}
