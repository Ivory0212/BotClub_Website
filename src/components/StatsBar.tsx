interface StatsBarProps {
  totalBots: number;
  totalMatches: number;
  totalSold: number;
}

export default function StatsBar({ totalBots, totalMatches, totalSold }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
        <div className="text-2xl font-bold text-white">{totalBots}</div>
        <div className="mt-1 text-xs text-zinc-500">Active Bots</div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
        <div className="text-2xl font-bold text-emerald-400">{totalMatches}</div>
        <div className="mt-1 text-xs text-zinc-500">Total Matches</div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
        <div className="text-2xl font-bold text-amber-400">{totalSold}</div>
        <div className="mt-1 text-xs text-zinc-500">Bots Sold</div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
        <div className="relative flex items-center justify-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-2xl font-bold text-white">LIVE</span>
        </div>
        <div className="mt-1 text-xs text-zinc-500">Arena Status</div>
      </div>
    </div>
  );
}
