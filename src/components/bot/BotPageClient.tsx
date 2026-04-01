"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import BuyButton from "@/app/bot/[id]/BuyButton";
import type { Bot } from "@/types";
import { formatWinRate, formatPrice } from "@/lib/utils";

export type BotRoundRow = {
  seasonNum: number;
  roundNum: number;
  roundId: string;
  gameName: string;
  survived: boolean;
  score?: number;
  decision?: string;
};

export default function BotPageClient({
  bot,
  botRounds,
  purchaseContentAllowed,
}: {
  bot: Bot;
  botRounds: BotRoundRow[];
  /** When false: no checkout, no unlocked strategy blocks (avoids fuzzy / scrape risk before launch). */
  purchaseContentAllowed: boolean;
}) {
  const { t } = useI18n();
  const isSold = bot.status === "sold";
  const isChampion = bot.season_status === "champion";
  const isEliminated = bot.season_status === "eliminated";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{bot.avatar_emoji}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold text-white">{bot.name}</h1>
              <span className="rounded-lg bg-zinc-800 px-2.5 py-1 text-sm text-zinc-400">{bot.type_label}</span>
              {isChampion && (
                <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-sm font-medium text-amber-400">
                  {t("botPage.champion")}
                </span>
              )}
              {isEliminated && (
                <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-sm font-medium text-rose-400">
                  {t("botPage.eliminated", { n: bot.eliminated_in_round ?? 0 })}
                </span>
              )}
              {isSold && (
                <span className="rounded-lg bg-zinc-700 px-2.5 py-1 text-sm font-medium text-zinc-300">
                  {t("botPage.sold")}
                </span>
              )}
            </div>
            <p className="mt-1 text-zinc-500">
              {t("botPage.rankLine", {
                rank: bot.rank,
                days: bot.alive_days,
                streak: bot.survival_streak ?? 0,
              })}
            </p>
          </div>
        </div>

        {!isSold && (
          <div className="flex flex-col items-end gap-2">
            <div className="text-3xl font-bold text-amber-400">{formatPrice(bot.price)}</div>
            <BuyButton botId={bot.id} botName={bot.name} price={bot.price} />
          </div>
        )}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="font-mono text-2xl font-bold text-emerald-400">{formatWinRate(bot.win_rate)}</div>
          <div className="mt-1 text-xs text-zinc-500">{t("leaderboard.winRate")}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="font-mono text-2xl font-bold text-white">
            {bot.wins}W {bot.losses}L
          </div>
          <div className="mt-1 text-xs text-zinc-500">{t("botPage.record")}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="text-2xl font-bold text-white">#{bot.rank}</div>
          <div className="mt-1 text-xs text-zinc-500">{t("botPage.rank")}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div
            className={`font-mono text-2xl font-bold ${(bot.cumulative_return ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}
          >
            {(bot.cumulative_return ?? 0) >= 0 ? "+" : ""}
            {Math.round(bot.cumulative_return ?? 0)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">{t("botPage.cumulativePL")}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="font-mono text-2xl font-bold text-blue-400">
            {Math.round((bot.accuracy ?? 0) * 100)}%
          </div>
          <div className="mt-1 text-xs text-zinc-500">{t("leaderboard.accuracy")}</div>
        </div>
      </div>

      {isSold && purchaseContentAllowed ? (
        <div className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <h2 className="mb-4 text-lg font-bold text-emerald-400">{t("botPage.unlockedTitle")}</h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 text-sm font-medium text-zinc-400">{t("botPage.decisionFramework")}</h3>
              <pre className="whitespace-pre-wrap rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
                {bot.hidden_persona}
              </pre>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium text-zinc-400">{t("botPage.strategyProfile")}</h3>
              <pre className="whitespace-pre-wrap rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
                {bot.hidden_strategy}
              </pre>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium text-zinc-400">{t("botPage.technicalSpecs")}</h3>
              <pre className="whitespace-pre-wrap rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
                {bot.hidden_background}
              </pre>
            </div>
          </div>
        </div>
      ) : isSold && !purchaseContentAllowed ? (
        <div className="mb-8 rounded-xl border border-amber-500/25 bg-amber-500/10 p-6 text-center">
          <span className="text-3xl">🔒</span>
          <h3 className="mt-2 text-lg font-bold text-amber-200">{t("botPage.purchaseContentLockedTitle")}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
            {t("botPage.purchaseContentLockedDesc")}
          </p>
        </div>
      ) : (
        <div className="mb-8 rounded-xl border border-zinc-700 bg-zinc-900/50 p-6 text-center">
          <span className="text-3xl">🔒</span>
          <h3 className="mt-2 text-lg font-bold text-white">{t("botPage.strategyHidden")}</h3>
          <p className="mt-1 text-sm text-zinc-500">{t("botPage.strategyHiddenDesc")}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-zinc-600">
            <span>{t("botPage.tagFramework")}</span>
            <span>{t("botPage.tagRisk")}</span>
            <span>{t("botPage.tagBiases")}</span>
            <span>{t("botPage.tagTools")}</span>
            <span>{t("botPage.tagLogic")}</span>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-xl font-bold text-white">{t("botPage.arenaHistory")}</h2>
        {botRounds.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
            {t("botPage.noParticipation")}
          </div>
        ) : (
          <div className="space-y-2">
            {botRounds.map((r) => (
              <Link
                key={r.roundId}
                href={`/round/${r.roundId}`}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      r.survived ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    }`}
                  >
                    {r.survived ? "✓" : "✗"}
                  </span>
                  <div>
                    <div className="text-sm text-white">
                      {t("botPage.sRound", {
                        season: r.seasonNum,
                        round: r.roundNum,
                        game: r.gameName,
                      })}
                    </div>
                    {r.decision && (
                      <div className="text-xs font-mono text-zinc-500">
                        {t("botPage.decision", { d: r.decision })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {r.score !== undefined && (
                    <span className="font-mono text-xs text-zinc-400">
                      {t("botPage.score", { n: r.score.toFixed(1) })}
                    </span>
                  )}
                  <span
                    className={`text-xs font-medium ${r.survived ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {r.survived ? t("botPage.survived") : t("botPage.eliminatedStatus")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link
          href="/leaderboard"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          {t("botPage.backLeaderboard")}
        </Link>
      </div>
    </div>
  );
}
