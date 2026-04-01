"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Round, Season } from "@/types";

const EVENT_STYLES: Record<string, { bg: string; border: string; icon?: string }> = {
  analysis: { bg: "bg-blue-500/5", border: "border-blue-500/20", icon: "🔍" },
  decision: { bg: "bg-zinc-900/30", border: "border-zinc-800", icon: "🎯" },
  reveal: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: "🔓" },
  outcome: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", icon: "📊" },
  elimination: { bg: "bg-rose-500/10", border: "border-rose-500/30", icon: "💀" },
  twist: { bg: "bg-purple-500/5", border: "border-purple-500/20", icon: "⚡" },
  inner_thought: { bg: "bg-zinc-800/50", border: "border-zinc-700 border-dashed", icon: "💭" },
  comparison: { bg: "bg-amber-500/5", border: "border-amber-500/20", icon: "⚖️" },
  tool_call: { bg: "bg-cyan-500/5", border: "border-cyan-500/25", icon: "🔧" },
  tool_result: { bg: "bg-sky-500/5", border: "border-sky-500/25", icon: "📎" },
  poker_action: { bg: "bg-violet-500/5", border: "border-violet-500/25", icon: "♠" },
  poker_deal: { bg: "bg-indigo-500/5", border: "border-indigo-500/25", icon: "🃏" },
};

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

export default function RoundPageClient({ season, round }: { season: Season; round: Round }) {
  const { t } = useI18n();
  const survivors = round.participants.filter((p) => p.survived);
  const eliminated = round.participants.filter((p) => !p.survived);
  const gameIcon = GAME_ICONS[round.game_type] ?? "🎮";
  const ranked = [...round.participants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="mb-2 text-sm text-zinc-500">
          {t("roundPage.breadcrumb", {
            sn: season.number,
            rn: round.round_number,
            tr: season.total_rounds,
          })}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{gameIcon}</span>
            <div>
              <h1 className="text-3xl font-bold text-white">{round.game_name}</h1>
              <p className="mt-1 text-zinc-400">{round.game_description}</p>
            </div>
          </div>
          <Link
            href={`/round/${round.id}/live`}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            {t("roundPage.liveReplay")}
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="text-2xl font-bold text-white">{round.participants.length}</div>
          <div className="mt-1 text-xs text-zinc-500">{t("roundPage.entered")}</div>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-center">
          <div className="text-2xl font-bold text-rose-400">{eliminated.length}</div>
          <div className="mt-1 text-xs text-zinc-500">{t("roundPage.eliminated")}</div>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{survivors.length}</div>
          <div className="mt-1 text-xs text-zinc-500">{t("roundPage.survived")}</div>
        </div>
      </div>

      {round.challenge && (
        <div className="mb-8 rounded-xl border border-blue-500/20 bg-blue-500/5 p-6">
          <h2 className="mb-3 text-lg font-bold text-blue-400">📋 {t("roundPage.challengeDetails")}</h2>
          <p className="text-sm text-zinc-300">{round.challenge.scenario}</p>
          {round.challenge.optimal_answer && (
            <div className="mt-4 rounded-lg bg-zinc-900/80 p-4">
              <div className="text-xs font-medium text-zinc-500">{t("roundPage.optimalAnswer")}</div>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
                {round.challenge.optimal_answer}
              </div>
              {round.challenge.explanation && (
                <p className="mt-2 text-xs text-zinc-500">{round.challenge.explanation}</p>
              )}
            </div>
          )}
        </div>
      )}

      {round.challenge && ranked.length > 0 && (
        <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="mb-4 text-lg font-bold text-amber-400">⚖️ {t("roundPage.theoryVsActual")}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-zinc-900/80 p-4 text-center">
              <div className="text-xs font-medium text-zinc-500">{t("roundPage.theoreticalOptimal")}</div>
              <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
                {round.challenge.optimal_answer ?? "—"}
              </div>
              <div className="mt-1 text-xs text-zinc-600">{t("roundPage.perfectScore")}</div>
            </div>
            <div className="rounded-lg bg-zinc-900/80 p-4 text-center">
              <div className="text-xs font-medium text-zinc-500">{t("roundPage.bestBot")}</div>
              <div className="mt-1 font-mono text-xl font-bold text-blue-400">
                {ranked[0].decision ?? "—"}
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                {t("roundPage.bestBotMeta", {
                  emoji: ranked[0].bot?.avatar_emoji ?? "",
                  name: ranked[0].bot?.name ?? "",
                  score: ranked[0].score?.toFixed(1) ?? "—",
                })}
              </div>
            </div>
            <div className="rounded-lg bg-zinc-900/80 p-4 text-center">
              <div className="text-xs font-medium text-zinc-500">{t("roundPage.fieldAverage")}</div>
              <div className="mt-1 font-mono text-xl font-bold text-zinc-300">
                {(ranked.reduce((s, p) => s + (p.score ?? 0), 0) / ranked.length).toFixed(1)}
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                {t("roundPage.avgDeviation", {
                  n: (ranked.reduce((s, p) => s + (p.optimal_delta ?? 0), 0) / ranked.length).toFixed(1),
                })}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-zinc-500">
              <span>{t("roundPage.scoreDistribution")}</span>
              <span>
                {t("roundPage.scored70", {
                  k: ranked.filter((p) => (p.score ?? 0) >= 70).length,
                  n: ranked.length,
                })}
              </span>
            </div>
            <div className="flex h-6 gap-0.5 overflow-hidden rounded-lg">
              {ranked.map((p) => (
                <div
                  key={p.bot_id}
                  className={`transition-all ${
                    (p.score ?? 0) >= 80
                      ? "bg-emerald-500"
                      : (p.score ?? 0) >= 60
                        ? "bg-emerald-700"
                        : (p.score ?? 0) >= 40
                          ? "bg-amber-600"
                          : "bg-rose-600"
                  } ${!p.survived ? "opacity-40" : ""}`}
                  style={{ flex: 1 }}
                  title={`${p.bot?.name}: ${p.score?.toFixed(1)}`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-emerald-400">
                {t("roundPage.best", { n: ranked[0].score?.toFixed(1) ?? "—" })}
              </span>
              <span className="text-rose-400">
                {t("roundPage.worst", { n: ranked[ranked.length - 1].score?.toFixed(1) ?? "—" })}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-white">📊 {t("roundPage.scoreboard")}</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                  {t("roundPage.tableBot")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                  {t("roundPage.decision")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                  {t("roundPage.score")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                  {t("roundPage.vsOptimal")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                  {t("roundPage.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p, i) => (
                <tr
                  key={p.bot_id}
                  className={`border-b border-zinc-800/50 ${
                    !p.survived ? "bg-rose-500/5 opacity-70" : i === 0 ? "bg-emerald-500/5" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/bot/${p.bot_id}`} className="flex items-center gap-2 hover:text-emerald-400">
                      <span className="text-lg">{p.bot?.avatar_emoji}</span>
                      <span
                        className={`text-sm font-medium ${p.survived ? "text-white" : "text-zinc-400 line-through"}`}
                      >
                        {p.bot?.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">{p.decision ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-white">
                    {p.score?.toFixed(1) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {p.optimal_delta !== undefined ? (
                      <span
                        className={
                          p.optimal_delta < 5
                            ? "text-emerald-400"
                            : p.optimal_delta < 15
                              ? "text-amber-400"
                              : "text-rose-400"
                        }
                      >
                        {p.optimal_delta.toFixed(1)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        p.survived ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {p.survived ? t("botPage.survived") : t("botPage.eliminatedStatus")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-white">📜 {t("roundPage.roundEvents")}</h2>
        <div className="space-y-3">
          {round.events.map((event) => {
            const style = EVENT_STYLES[event.type] ?? EVENT_STYLES.decision;

            return (
              <div
                key={event.id}
                className={`rounded-xl border ${style.border} ${style.bg} p-4 ${
                  event.is_dramatic ? "ring-1 ring-amber-500/20" : ""
                }`}
              >
                {event.actor_name && event.type !== "inner_thought" && event.type !== "elimination" && (
                  <div className="mb-1.5 flex items-center gap-2">
                    {event.type === "analysis" || event.type === "decision" ? (
                      <Link
                        href={`/bot/${event.actor_id}`}
                        className="text-sm font-bold text-white hover:text-emerald-400"
                      >
                        {event.actor_name}
                      </Link>
                    ) : (
                      <span className="text-sm font-bold text-white">{event.actor_name}</span>
                    )}
                  </div>
                )}

                <p
                  className={`text-sm leading-relaxed ${
                    event.is_dramatic
                      ? "font-medium text-white"
                      : event.type === "inner_thought"
                        ? "italic text-zinc-500"
                        : event.type === "elimination"
                          ? "font-medium text-rose-300"
                          : event.type === "comparison"
                            ? "font-mono text-amber-300"
                            : event.type === "reveal"
                              ? "text-amber-200"
                              : "text-zinc-300"
                  }`}
                  style={{ whiteSpace: "pre-line" }}
                >
                  {event.content}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {eliminated.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-rose-400">💀 {t("roundPage.eliminatedThisRound")}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {eliminated.map((p) => (
              <Link
                key={p.bot_id}
                href={`/bot/${p.bot_id}`}
                className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 transition-all hover:bg-rose-500/10"
              >
                <span className="text-2xl opacity-50">{p.bot?.avatar_emoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-300 line-through">{p.bot?.name}</div>
                  <div className="text-xs text-zinc-500">{p.bot?.type_label}</div>
                </div>
                {p.score !== undefined && (
                  <span className="font-mono text-xs text-zinc-500">
                    {t("botPage.score", { n: p.score.toFixed(1) })}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {survivors.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-emerald-400">{t("roundPage.survivors")}</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {survivors.map((p) => (
              <Link
                key={p.bot_id}
                href={`/bot/${p.bot_id}`}
                className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 transition-all hover:bg-emerald-500/10"
              >
                <span className="text-2xl">{p.bot?.avatar_emoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{p.bot?.name}</div>
                  <div className="text-xs text-zinc-500">{p.bot?.type_label}</div>
                </div>
                {p.score !== undefined && (
                  <span className="font-mono text-xs text-emerald-400">{p.score.toFixed(1)}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <Link
          href={`/season/${season.id}`}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          {t("roundPage.backSeason", { n: season.number })}
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          {t("roundPage.viewLeaderboard")}
        </Link>
      </div>
    </div>
  );
}
