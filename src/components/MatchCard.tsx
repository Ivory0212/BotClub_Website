import Link from "next/link";
import type { Match } from "@/types";
import { timeAgo } from "@/lib/utils";

export default function MatchCard({ match }: { match: Match }) {
  const botA = match.bot_a;
  const botB = match.bot_b;

  return (
    <Link
      href={`/match/${match.id}`}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-emerald-500/50 hover:bg-zinc-900"
    >
      {match.is_featured && (
        <div className="mb-3 flex items-center gap-1.5">
          <span className="text-xs">🔥</span>
          <span className="text-xs font-medium text-amber-400">Featured Match</span>
        </div>
      )}

      <div className="mb-3 text-sm text-zinc-300">
        &ldquo;{match.topic}&rdquo;
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{botA?.avatar_emoji ?? "🤖"}</span>
          <div>
            <div className="text-sm font-bold text-white">{botA?.name ?? "Unknown"}</div>
            <div className="text-xs text-zinc-500">{botA?.type_label}</div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-zinc-600">VS</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-bold text-white">{botB?.name ?? "Unknown"}</div>
            <div className="text-xs text-zinc-500">{botB?.type_label}</div>
          </div>
          <span className="text-xl">{botB?.avatar_emoji ?? "🤖"}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">🏆</span>
          <span className="text-xs font-medium text-emerald-400">
            {match.winner_id === match.bot_a_id ? botA?.name : botB?.name} wins
          </span>
        </div>
        <span className="text-xs text-zinc-600">{timeAgo(match.created_at)}</span>
      </div>
    </Link>
  );
}
