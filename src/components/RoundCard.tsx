import Link from "next/link";
import type { Round } from "@/types";

const GAME_ICONS: Record<string, string> = {
  market_forecast: "📈",
  resource_allocation: "💰",
  prisoners_dilemma: "🤝",
  risk_assessment: "⚠️",
  auction_wars: "🏛️",
  final_optimization: "⚔️",
};

export default function RoundCard({ round }: { round: Round }) {
  const icon = GAME_ICONS[round.game_type] ?? "🎮";
  const eliminatedCount = round.eliminated_ids.length;
  const totalParticipants = round.participants.length;

  return (
    <Link
      href={`/round/${round.id}`}
      className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-emerald-500/50 hover:bg-zinc-900"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-2xl">
        {icon}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">
            Round {round.round_number}
          </span>
          <span className="text-sm text-zinc-400">— {round.game_name}</span>
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {totalParticipants} entered · {eliminatedCount} eliminated ·{" "}
          {round.survivor_count} survived
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            round.status === "completed"
              ? "bg-zinc-800 text-zinc-400"
              : "bg-emerald-500/10 text-emerald-400"
          }`}
        >
          {round.status === "completed" ? "Completed" : "Live"}
        </span>
        <span className="text-xs text-rose-400">💀 {eliminatedCount}</span>
      </div>
    </Link>
  );
}
