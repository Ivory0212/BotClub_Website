"use client";

import Link from "next/link";
import RoundCard from "@/components/RoundCard";
import RunRoundButton from "@/app/season/[id]/RunRoundButton";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Season } from "@/types";

export default function SeasonPageClient({ season }: { season: Season }) {
  const { t } = useI18n();
  const isActive = season.status === "active";
  const eliminatedTotal = season.rounds.reduce((sum, r) => sum + r.eliminated_ids.length, 0);

  let subtitle: string;
  if (isActive) {
    subtitle = t("seasonPage.subtitleActive", { total: season.total_bots, alive: season.alive_bots });
  } else if (season.champion) {
    subtitle = t("seasonPage.subtitleChampion", {
      total: season.total_bots,
      emoji: season.champion.avatar_emoji,
      name: season.champion.name,
    });
  } else {
    subtitle = t("seasonPage.subtitleEnded", { total: season.total_bots });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-white">{t("seasonPage.season", { n: season.number })}</h1>
          <span
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              isActive
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-700 bg-zinc-800 text-zinc-400"
            }`}
          >
            {isActive ? t("seasonPage.live") : t("seasonPage.completed")}
          </span>
        </div>

        <p className="mt-2 text-zinc-400">{subtitle}</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="text-2xl font-bold text-white">{season.total_bots}</div>
          <div className="mt-1 text-xs text-zinc-500">{t("seasonPage.started")}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{season.alive_bots}</div>
          <div className="mt-1 text-xs text-zinc-500">{t("seasonPage.alive")}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="text-2xl font-bold text-rose-400">{eliminatedTotal}</div>
          <div className="mt-1 text-xs text-zinc-500">{t("seasonPage.eliminated")}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {season.current_round}/{season.total_rounds}
          </div>
          <div className="mt-1 text-xs text-zinc-500">{t("seasonPage.rounds")}</div>
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>{t("seasonPage.barBots", { n: season.total_bots })}</span>
          <span>{t("seasonPage.barAlive", { n: season.alive_bots })}</span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-zinc-800">
          <div className="flex h-full">
            <div
              className="bg-rose-500/80 transition-all"
              style={{
                width: `${((season.total_bots - season.alive_bots) / season.total_bots) * 100}%`,
              }}
            />
            <div
              className="bg-emerald-500 transition-all"
              style={{
                width: `${(season.alive_bots / season.total_bots) * 100}%`,
              }}
            />
          </div>
        </div>
        <div className="mt-1 flex justify-between text-xs">
          <span className="text-rose-400">💀 {t("seasonPage.eliminatedBar")}</span>
          <span className="text-emerald-400">✅ {t("seasonPage.aliveBar")}</span>
        </div>
      </div>

      {season.champion && (
        <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <div className="text-4xl">👑</div>
          <h2 className="mt-2 text-xl font-bold text-amber-400">{t("seasonPage.championTitle")}</h2>
          <Link href={`/bot/${season.champion.id}`} className="group">
            <div className="mt-3 text-4xl">{season.champion.avatar_emoji}</div>
            <div className="mt-2 text-lg font-bold text-white group-hover:text-amber-400">
              {season.champion.name}
            </div>
            <div className="text-sm text-zinc-500">{season.champion.type_label}</div>
          </Link>
        </div>
      )}

      {isActive && season.alive_bots > 1 && (
        <div className="mb-8 text-center">
          <RunRoundButton seasonId={season.id} />
        </div>
      )}

      <div>
        <h2 className="mb-4 text-xl font-bold text-white">{t("seasonPage.roundsTitle")}</h2>
        {season.rounds.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
            <span className="text-3xl">⏳</span>
            <p className="mt-2">{t("seasonPage.noRounds")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...season.rounds].reverse().map((round) => (
              <RoundCard key={round.id} round={round} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link
          href="/"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          {t("seasonPage.backHome")}
        </Link>
      </div>
    </div>
  );
}
