import Link from "next/link";
import { notFound } from "next/navigation";
import { getBotById, getAllSeasons } from "@/lib/store";
import { formatWinRate, formatPrice } from "@/lib/utils";
import BuyButton from "./BuyButton";

export default async function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bot = getBotById(id);

  if (!bot) return notFound();

  const isSold = bot.status === "sold";
  const isChampion = bot.season_status === "champion";
  const isEliminated = bot.season_status === "eliminated";

  // Find rounds this bot participated in
  const seasons = getAllSeasons();
  const botRounds: { seasonNum: number; roundNum: number; roundId: string; gameName: string; survived: boolean; score?: number; decision?: string }[] = [];
  for (const season of seasons) {
    for (const round of season.rounds) {
      const participant = round.participants.find((p) => p.bot_id === id);
      if (participant) {
        botRounds.push({
          seasonNum: season.number,
          roundNum: round.round_number,
          roundId: round.id,
          gameName: round.game_name,
          survived: participant.survived,
          score: participant.score,
          decision: participant.decision,
        });
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{bot.avatar_emoji}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold text-white">{bot.name}</h1>
              <span className="rounded-lg bg-zinc-800 px-2.5 py-1 text-sm text-zinc-400">
                {bot.type_label}
              </span>
              {isChampion && (
                <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-sm font-medium text-amber-400">
                  CHAMPION
                </span>
              )}
              {isEliminated && (
                <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-sm font-medium text-rose-400">
                  ELIMINATED R{bot.eliminated_in_round}
                </span>
              )}
              {isSold && (
                <span className="rounded-lg bg-zinc-700 px-2.5 py-1 text-sm font-medium text-zinc-300">
                  SOLD
                </span>
              )}
            </div>
            <p className="mt-1 text-zinc-500">
              Rank #{bot.rank} &middot; Alive {bot.alive_days} days
              &middot; Streak: {bot.survival_streak ?? 0}
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

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="font-mono text-2xl font-bold text-emerald-400">
            {formatWinRate(bot.win_rate)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Win Rate</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="font-mono text-2xl font-bold text-white">
            {bot.wins}W {bot.losses}L
          </div>
          <div className="mt-1 text-xs text-zinc-500">Record</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="text-2xl font-bold text-white">#{bot.rank}</div>
          <div className="mt-1 text-xs text-zinc-500">Rank</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className={`font-mono text-2xl font-bold ${(bot.cumulative_return ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {(bot.cumulative_return ?? 0) >= 0 ? "+" : ""}{Math.round(bot.cumulative_return ?? 0)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Cumulative P/L</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="font-mono text-2xl font-bold text-blue-400">
            {Math.round((bot.accuracy ?? 0) * 100)}%
          </div>
          <div className="mt-1 text-xs text-zinc-500">Accuracy</div>
        </div>
      </div>

      {/* Hidden Info */}
      {isSold ? (
        <div className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <h2 className="mb-4 text-lg font-bold text-emerald-400">
            Unlocked: Decision-Making Framework
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 text-sm font-medium text-zinc-400">Decision Framework & Persona</h3>
              <pre className="whitespace-pre-wrap rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
                {bot.hidden_persona}
              </pre>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium text-zinc-400">Strategy Profile</h3>
              <pre className="whitespace-pre-wrap rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
                {bot.hidden_strategy}
              </pre>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-medium text-zinc-400">Technical Specs</h3>
              <pre className="whitespace-pre-wrap rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
                {bot.hidden_background}
              </pre>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8 rounded-xl border border-zinc-700 bg-zinc-900/50 p-6 text-center">
          <span className="text-3xl">🔒</span>
          <h3 className="mt-2 text-lg font-bold text-white">Strategy Hidden</h3>
          <p className="mt-1 text-sm text-zinc-500">
            This bot&apos;s decision framework, risk model, cognitive biases, and tool chain are encrypted.
            Purchase to unlock the full configuration.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-zinc-600">
            <span>Decision Framework</span>
            <span>Risk Profile</span>
            <span>Cognitive Biases</span>
            <span>Analysis Tools</span>
            <span>Strategy Logic</span>
          </div>
        </div>
      )}

      {/* Round History */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-white">Arena History</h2>
        {botRounds.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
            No arena participation yet.
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
                      r.survived
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-rose-500/10 text-rose-400"
                    }`}
                  >
                    {r.survived ? "✓" : "✗"}
                  </span>
                  <div>
                    <div className="text-sm text-white">
                      S{r.seasonNum} Round {r.roundNum} — {r.gameName}
                    </div>
                    {r.decision && (
                      <div className="text-xs font-mono text-zinc-500">Decision: {r.decision}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {r.score !== undefined && (
                    <span className="font-mono text-xs text-zinc-400">
                      Score: {r.score.toFixed(1)}
                    </span>
                  )}
                  <span className={`text-xs font-medium ${r.survived ? "text-emerald-400" : "text-rose-400"}`}>
                    {r.survived ? "Survived" : "Eliminated"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Back */}
      <div className="mt-8">
        <Link
          href="/leaderboard"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          ← Leaderboard
        </Link>
      </div>
    </div>
  );
}
