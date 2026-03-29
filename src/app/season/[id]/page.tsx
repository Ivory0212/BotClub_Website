import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeasonById } from "@/lib/store";
import RoundCard from "@/components/RoundCard";
import RunRoundButton from "./RunRoundButton";

export default async function SeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const season = getSeasonById(id);

  if (!season) return notFound();

  const isActive = season.status === "active";
  const eliminatedTotal = season.rounds.reduce((sum, r) => sum + r.eliminated_ids.length, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-white">Season {season.number}</h1>
          <span
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              isActive
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-700 bg-zinc-800 text-zinc-400"
            }`}
          >
            {isActive ? "🔴 LIVE" : "COMPLETED"}
          </span>
        </div>

        <p className="mt-2 text-zinc-400">
          {season.total_bots} bots entered the arena. {isActive
            ? `${season.alive_bots} remain.`
            : season.champion
              ? `${season.champion.avatar_emoji} ${season.champion.name} is the champion.`
              : "Season ended."}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="text-2xl font-bold text-white">{season.total_bots}</div>
          <div className="mt-1 text-xs text-zinc-500">Started</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{season.alive_bots}</div>
          <div className="mt-1 text-xs text-zinc-500">Alive</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="text-2xl font-bold text-rose-400">{eliminatedTotal}</div>
          <div className="mt-1 text-xs text-zinc-500">Eliminated</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {season.current_round}/{season.total_rounds}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Rounds</div>
        </div>
      </div>

      {/* Elimination progress bar */}
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-xs text-zinc-500">
          <span>{season.total_bots} bots</span>
          <span>{season.alive_bots} alive</span>
        </div>
        <div className="h-4 rounded-full bg-zinc-800 overflow-hidden">
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
          <span className="text-rose-400">💀 Eliminated</span>
          <span className="text-emerald-400">✅ Alive</span>
        </div>
      </div>

      {/* Champion */}
      {season.champion && (
        <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <div className="text-4xl">👑</div>
          <h2 className="mt-2 text-xl font-bold text-amber-400">CHAMPION</h2>
          <Link href={`/bot/${season.champion.id}`} className="group">
            <div className="mt-3 text-4xl">{season.champion.avatar_emoji}</div>
            <div className="mt-2 text-lg font-bold text-white group-hover:text-amber-400">
              {season.champion.name}
            </div>
            <div className="text-sm text-zinc-500">{season.champion.type_label}</div>
          </Link>
        </div>
      )}

      {/* Run Next Round Button */}
      {isActive && season.alive_bots > 1 && (
        <div className="mb-8 text-center">
          <RunRoundButton seasonId={season.id} />
        </div>
      )}

      {/* Rounds */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-white">Rounds</h2>
        {season.rounds.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
            <span className="text-3xl">⏳</span>
            <p className="mt-2">No rounds played yet. The games are about to begin...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...season.rounds].reverse().map((round) => (
              <RoundCard key={round.id} round={round} />
            ))}
          </div>
        )}
      </div>

      {/* Back */}
      <div className="mt-8">
        <Link
          href="/"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
