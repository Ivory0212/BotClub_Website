import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoundById } from "@/lib/store";

const EVENT_STYLES: Record<string, { bg: string; border: string; icon?: string }> = {
  analysis: { bg: "bg-blue-500/5", border: "border-blue-500/20", icon: "🔍" },
  decision: { bg: "bg-zinc-900/30", border: "border-zinc-800", icon: "🎯" },
  reveal: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: "🔓" },
  outcome: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", icon: "📊" },
  elimination: { bg: "bg-rose-500/10", border: "border-rose-500/30", icon: "💀" },
  twist: { bg: "bg-purple-500/5", border: "border-purple-500/20", icon: "⚡" },
  inner_thought: { bg: "bg-zinc-800/50", border: "border-zinc-700 border-dashed", icon: "💭" },
  comparison: { bg: "bg-amber-500/5", border: "border-amber-500/20", icon: "⚖️" },
};

const GAME_ICONS: Record<string, string> = {
  market_forecast: "📈",
  resource_allocation: "💰",
  prisoners_dilemma: "🤝",
  risk_assessment: "⚠️",
  auction_wars: "🏛️",
  final_optimization: "⚔️",
};

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = getRoundById(id);

  if (!result) return notFound();

  const { season, round } = result;
  const survivors = round.participants.filter((p) => p.survived);
  const eliminated = round.participants.filter((p) => !p.survived);
  const gameIcon = GAME_ICONS[round.game_type] ?? "🎮";

  // Sort participants by score for the scoreboard
  const ranked = [...round.participants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 text-sm text-zinc-500">
          Season {season.number} &middot; Round {round.round_number} of {season.total_rounds}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-4xl">{gameIcon}</span>
          <div>
            <h1 className="text-3xl font-bold text-white">{round.game_name}</h1>
            <p className="mt-1 text-zinc-400">{round.game_description}</p>
          </div>
        </div>
      </div>

      {/* Round stats */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="text-2xl font-bold text-white">{round.participants.length}</div>
          <div className="mt-1 text-xs text-zinc-500">Entered</div>
        </div>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-center">
          <div className="text-2xl font-bold text-rose-400">{eliminated.length}</div>
          <div className="mt-1 text-xs text-zinc-500">Eliminated</div>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{survivors.length}</div>
          <div className="mt-1 text-xs text-zinc-500">Survived</div>
        </div>
      </div>

      {/* Challenge Info */}
      {round.challenge && (
        <div className="mb-8 rounded-xl border border-blue-500/20 bg-blue-500/5 p-6">
          <h2 className="mb-3 text-lg font-bold text-blue-400">📋 Challenge Details</h2>
          <p className="text-sm text-zinc-300">{round.challenge.scenario}</p>
          {round.challenge.optimal_answer && (
            <div className="mt-4 rounded-lg bg-zinc-900/80 p-4">
              <div className="text-xs font-medium text-zinc-500">OPTIMAL ANSWER</div>
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

      {/* Theory vs Actual */}
      {round.challenge && ranked.length > 0 && (
        <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="mb-4 text-lg font-bold text-amber-400">⚖️ Theory vs Actual Performance</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-zinc-900/80 p-4 text-center">
              <div className="text-xs font-medium text-zinc-500">THEORETICAL OPTIMAL</div>
              <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
                {round.challenge.optimal_answer ?? "—"}
              </div>
              <div className="mt-1 text-xs text-zinc-600">Perfect score: 100.0</div>
            </div>
            <div className="rounded-lg bg-zinc-900/80 p-4 text-center">
              <div className="text-xs font-medium text-zinc-500">BEST BOT</div>
              <div className="mt-1 font-mono text-xl font-bold text-blue-400">
                {ranked[0].decision ?? "—"}
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                {ranked[0].bot?.avatar_emoji} {ranked[0].bot?.name} — Score: {ranked[0].score?.toFixed(1)}
              </div>
            </div>
            <div className="rounded-lg bg-zinc-900/80 p-4 text-center">
              <div className="text-xs font-medium text-zinc-500">FIELD AVERAGE</div>
              <div className="mt-1 font-mono text-xl font-bold text-zinc-300">
                {(ranked.reduce((s, p) => s + (p.score ?? 0), 0) / ranked.length).toFixed(1)}
              </div>
              <div className="mt-1 text-xs text-zinc-600">
                Avg deviation: {(ranked.reduce((s, p) => s + (p.optimal_delta ?? 0), 0) / ranked.length).toFixed(1)}
              </div>
            </div>
          </div>
          {/* Performance distribution bar */}
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-zinc-500">
              <span>Score Distribution (0-100)</span>
              <span>{ranked.filter(p => (p.score ?? 0) >= 70).length}/{ranked.length} scored 70+</span>
            </div>
            <div className="flex h-6 gap-0.5 overflow-hidden rounded-lg">
              {ranked.map((p, i) => (
                <div
                  key={p.bot_id}
                  className={`transition-all ${
                    (p.score ?? 0) >= 80 ? "bg-emerald-500" :
                    (p.score ?? 0) >= 60 ? "bg-emerald-700" :
                    (p.score ?? 0) >= 40 ? "bg-amber-600" :
                    "bg-rose-600"
                  } ${!p.survived ? "opacity-40" : ""}`}
                  style={{ flex: 1 }}
                  title={`${p.bot?.name}: ${p.score?.toFixed(1)}`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-emerald-400">Best: {ranked[0].score?.toFixed(1)}</span>
              <span className="text-rose-400">Worst: {ranked[ranked.length - 1].score?.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Scoreboard */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-white">📊 Scoreboard</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Bot</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Decision</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Score</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">vs Optimal</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Status</th>
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
                      <span className={`text-sm font-medium ${p.survived ? "text-white" : "text-zinc-400 line-through"}`}>
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
                      <span className={p.optimal_delta < 5 ? "text-emerald-400" : p.optimal_delta < 15 ? "text-amber-400" : "text-rose-400"}>
                        {p.optimal_delta.toFixed(1)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      p.survived ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    }`}>
                      {p.survived ? "Survived" : "Eliminated"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Timeline */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-white">📜 Round Events</h2>
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

      {/* Eliminated */}
      {eliminated.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-rose-400">💀 Eliminated This Round</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {eliminated.map((p) => (
              <Link
                key={p.bot_id}
                href={`/bot/${p.bot_id}`}
                className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 transition-all hover:bg-rose-500/10"
              >
                <span className="text-2xl opacity-50">{p.bot?.avatar_emoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-300 line-through">
                    {p.bot?.name}
                  </div>
                  <div className="text-xs text-zinc-500">{p.bot?.type_label}</div>
                </div>
                {p.score !== undefined && (
                  <span className="font-mono text-xs text-zinc-500">
                    Score: {p.score.toFixed(1)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Survivors */}
      {survivors.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-emerald-400">Survivors</h2>
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
                  <span className="font-mono text-xs text-emerald-400">
                    {p.score.toFixed(1)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-4">
        <Link
          href={`/season/${season.id}`}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          ← Back to Season {season.number}
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          View Leaderboard
        </Link>
      </div>
    </div>
  );
}
