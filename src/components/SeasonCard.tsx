import Link from "next/link";
import type { Season } from "@/types";

export default function SeasonCard({ season }: { season: Season }) {
  const statusColors = {
    upcoming: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    completed: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30",
  };

  const statusLabels = {
    upcoming: "UPCOMING",
    active: "🔴 LIVE",
    completed: "COMPLETED",
  };

  return (
    <Link
      href={`/season/${season.id}`}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-all hover:border-emerald-500/50 hover:bg-zinc-900"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Season {season.number}</h3>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColors[season.status]}`}
        >
          {statusLabels[season.status]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-lg font-bold text-white">{season.total_bots}</div>
          <div className="text-xs text-zinc-500">Started</div>
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-400">{season.alive_bots}</div>
          <div className="text-xs text-zinc-500">Alive</div>
        </div>
        <div>
          <div className="text-lg font-bold text-amber-400">
            {season.current_round}/{season.total_rounds}
          </div>
          <div className="text-xs text-zinc-500">Rounds</div>
        </div>
      </div>

      {/* Progress bar */}
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
            Champion: {season.champion.avatar_emoji} {season.champion.name}
          </span>
        </div>
      )}
    </Link>
  );
}
