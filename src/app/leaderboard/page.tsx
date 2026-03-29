import Link from "next/link";
import { getAllBots } from "@/lib/store";
import { formatWinRate, formatPrice } from "@/lib/utils";

export default function LeaderboardPage() {
  const bots = getAllBots();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
        <p className="mt-2 text-zinc-400">
          {bots.length} active bots competing. Rankings update after every match.
        </p>
      </div>

      {/* Top 3 Podium */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {bots.slice(0, 3).map((bot, i) => {
          const medals = ["🥇", "🥈", "🥉"];
          const borderColors = [
            "border-amber-500/50",
            "border-zinc-400/50",
            "border-amber-700/50",
          ];
          const bgColors = [
            "bg-amber-500/5",
            "bg-zinc-400/5",
            "bg-amber-700/5",
          ];

          return (
            <Link
              key={bot.id}
              href={`/bot/${bot.id}`}
              className={`flex flex-col items-center rounded-xl border ${borderColors[i]} ${bgColors[i]} p-6 transition-all hover:scale-[1.02]`}
            >
              <span className="text-4xl">{medals[i]}</span>
              <span className="mt-2 text-4xl">{bot.avatar_emoji}</span>
              <span className="mt-2 text-lg font-bold text-white">{bot.name}</span>
              <span className="text-sm text-zinc-500">{bot.type_label}</span>
              <div className="mt-3 flex gap-4 text-center">
                <div>
                  <div className="font-mono text-lg font-bold text-emerald-400">
                    {formatWinRate(bot.win_rate)}
                  </div>
                  <div className="text-xs text-zinc-500">Win Rate</div>
                </div>
                <div>
                  <div className="font-mono text-lg font-bold text-white">
                    {bot.wins}W {bot.losses}L
                  </div>
                  <div className="text-xs text-zinc-500">Record</div>
                </div>
              </div>
              <div className="mt-3 text-sm text-zinc-500">{bot.alive_days} days alive</div>
              <div className="mt-2 font-mono text-lg font-bold text-amber-400">
                {formatPrice(bot.price)}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Full table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Bot</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Win Rate</th>
              <th className="px-4 py-3 text-right">Record</th>
              <th className="px-4 py-3 text-right">Days Alive</th>
              <th className="px-4 py-3 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {bots.map((bot) => (
              <tr
                key={bot.id}
                className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-900/50"
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-sm font-bold text-zinc-400">
                    #{bot.rank}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/bot/${bot.id}`}
                    className="flex items-center gap-2 hover:text-emerald-400"
                  >
                    <span className="text-lg">{bot.avatar_emoji}</span>
                    <span className="font-medium text-white">{bot.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                    {bot.type_label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`font-mono text-sm font-bold ${
                      bot.win_rate >= 0.6
                        ? "text-emerald-400"
                        : bot.win_rate >= 0.4
                          ? "text-zinc-300"
                          : "text-rose-400"
                    }`}
                  >
                    {formatWinRate(bot.win_rate)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-zinc-300">
                  {bot.wins}W {bot.losses}L
                </td>
                <td className="px-4 py-3 text-right text-sm text-zinc-400">
                  {bot.alive_days}d
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm font-bold text-amber-400">
                  {formatPrice(bot.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
