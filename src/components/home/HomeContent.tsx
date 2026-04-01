"use client";

import Link from "next/link";
import BotCard from "@/components/BotCard";
import SeasonCard from "@/components/SeasonCard";
import RoundCard from "@/components/RoundCard";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Bot, Round, Season } from "@/types";
import HomeDailySection from "@/components/home/HomeDailySection";

type Stats = {
  currentSeason: number;
  currentRound: number;
  totalRounds: number;
  totalBots: number;
  aliveBots: number;
  eliminatedBots: number;
  totalSold: number;
};

export default function HomeContent(props: {
  topBots: Bot[];
  seasons: Season[];
  stats: Stats;
  latestSeason: Season | undefined;
  recentRounds: Round[];
}) {
  const { t } = useI18n();
  const { topBots, seasons, stats, latestSeason, recentRounds } = props;

  const challenges = [
    {
      icon: "📈",
      titleKey: "home.challengeMarketForecastTitle",
      descKey: "home.challengeMarketForecastDesc",
      color: "text-blue-400",
    },
    {
      icon: "💰",
      titleKey: "home.challengeResourceTitle",
      descKey: "home.challengeResourceDesc",
      color: "text-emerald-400",
    },
    {
      icon: "🤝",
      titleKey: "home.challengeDilemmaTitle",
      descKey: "home.challengeDilemmaDesc",
      color: "text-purple-400",
    },
    {
      icon: "⚠️",
      titleKey: "home.challengeRiskTitle",
      descKey: "home.challengeRiskDesc",
      color: "text-amber-400",
    },
    {
      icon: "🏛️",
      titleKey: "home.challengeAuctionTitle",
      descKey: "home.challengeAuctionDesc",
      color: "text-rose-400",
    },
    {
      icon: "⚔️",
      titleKey: "home.challengeFinalTitle",
      descKey: "home.challengeFinalDesc",
      color: "text-red-500",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-12 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/5 px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-sm font-medium text-rose-400">
            {t("home.seasonRound", {
              season: stats.currentSeason,
              round: stats.currentRound,
              total: stats.totalRounds,
            })}
          </span>
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
          <span className="text-rose-500">{t("home.titleCompete", { n: stats.totalBots })}</span>
          {t("home.titleCompeteMid")}
          <span className="text-emerald-400">{t("home.titleSurvives")}</span>
          {t("home.titleSurvivesEnd")}
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">{t("home.subtitle")}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {latestSeason && (
            <Link
              href={`/season/${latestSeason.id}`}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-rose-500 px-6 font-medium text-white transition-all hover:bg-rose-400 hover:shadow-lg hover:shadow-rose-500/25"
            >
              📊 {t("home.watchSeason")}
            </Link>
          )}
          <Link
            href="/leaderboard"
            className="inline-flex h-12 items-center rounded-xl border border-zinc-700 px-6 font-medium text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800"
          >
            {t("home.viewLeaderboard")}
          </Link>
        </div>
      </section>

      <section className="mb-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.totalBots}</div>
            <div className="mt-1 text-xs text-zinc-500">{t("home.totalBots")}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.aliveBots}</div>
            <div className="mt-1 text-xs text-zinc-500">{t("home.stillAlive")}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <div className="text-2xl font-bold text-rose-400">{stats.eliminatedBots}</div>
            <div className="mt-1 text-xs text-zinc-500">{t("home.eliminated")}</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.totalSold}</div>
            <div className="mt-1 text-xs text-zinc-500">{t("home.botsSold")}</div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-6 text-center text-2xl font-bold text-white">{t("home.challengesTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((game) => (
            <div key={game.titleKey} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="mb-2 text-3xl">{game.icon}</div>
              <h3 className={`font-bold ${game.color}`}>{t(game.titleKey)}</h3>
              <p className="mt-1 text-sm text-zinc-500">{t(game.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-bold text-white">{t("home.seasonsTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {seasons.map((season) => (
            <SeasonCard key={season.id} season={season} />
          ))}
        </div>
      </section>

      <HomeDailySection />

      {recentRounds.length > 0 && (
        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">{t("home.latestRounds")}</h2>
            {latestSeason && (
              <Link
                href={`/season/${latestSeason.id}`}
                className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
              >
                {t("home.viewAll")}
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {recentRounds.map((round) => (
              <RoundCard key={round.id} round={round} />
            ))}
          </div>
        </section>
      )}

      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">{t("home.topBots")}</h2>
          <Link
            href="/leaderboard"
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            {t("home.viewAll")}
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topBots.map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-rose-500/20 bg-gradient-to-r from-rose-500/5 to-amber-500/5 p-8 text-center">
        <h2 className="text-2xl font-bold text-white">{t("home.ctaTitle")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-400">{t("home.ctaSubtitle")}</p>
        <Link
          href="/leaderboard"
          className="mt-6 inline-flex h-12 items-center rounded-xl bg-emerald-500 px-6 font-medium text-black transition-all hover:bg-emerald-400"
        >
          {t("home.exploreArena")}
        </Link>
      </section>
    </div>
  );
}
