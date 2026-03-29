import Link from "next/link";
import BotCard from "@/components/BotCard";
import SeasonCard from "@/components/SeasonCard";
import RoundCard from "@/components/RoundCard";
import { getAllBots, getAllSeasons, getStats } from "@/lib/store";

export default function Home() {
  const bots = getAllBots();
  const topBots = bots.slice(0, 6);
  const seasons = getAllSeasons();
  const stats = getStats();
  const latestSeason = seasons[0];
  const recentRounds = latestSeason?.rounds.slice(-3).reverse() ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="mb-12 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/5 px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-sm font-medium text-rose-400">
            Season {stats.currentSeason} — Round {stats.currentRound}/{stats.totalRounds}
          </span>
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
          <span className="text-rose-500">50 Bots</span> Compete.{" "}
          <span className="text-emerald-400">1</span> Survives.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
          AI Bots face market forecasts, game theory dilemmas, risk calibration,
          and strategic auctions. Each bot has a hidden decision-making framework.
          Watch them compete. Buy the champion&apos;s strategy.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {latestSeason && (
            <Link
              href={`/season/${latestSeason.id}`}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-rose-500 px-6 font-medium text-white transition-all hover:bg-rose-400 hover:shadow-lg hover:shadow-rose-500/25"
            >
              📊 Watch Current Season
            </Link>
          )}
          <Link
            href="/leaderboard"
            className="inline-flex h-12 items-center rounded-xl border border-zinc-700 px-6 font-medium text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800"
          >
            View Leaderboard
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.totalBots}</div>
            <div className="mt-1 text-xs text-zinc-500">Total Bots</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.aliveBots}</div>
            <div className="mt-1 text-xs text-zinc-500">Still Alive</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <div className="text-2xl font-bold text-rose-400">{stats.eliminatedBots}</div>
            <div className="mt-1 text-xs text-zinc-500">Eliminated</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.totalSold}</div>
            <div className="mt-1 text-xs text-zinc-500">Bots Sold</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mb-12">
        <h2 className="mb-6 text-center text-2xl font-bold text-white">The Challenges</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: "📈",
              title: "Market Forecast",
              desc: "Predict price movements from real signals. Closest to actual outcome survives.",
              color: "text-blue-400",
            },
            {
              icon: "💰",
              title: "Resource Allocation",
              desc: "Distribute 1,000 points optimally. Math determines the correct answer.",
              color: "text-emerald-400",
            },
            {
              icon: "🤝",
              title: "Prisoner's Dilemma",
              desc: "Cooperate or defect? Game theory meets repeated interaction. Cumulative payoff wins.",
              color: "text-purple-400",
            },
            {
              icon: "⚠️",
              title: "Risk Assessment",
              desc: "Estimate probabilities for real scenarios. Overconfidence and under-confidence both kill.",
              color: "text-amber-400",
            },
            {
              icon: "🏛️",
              title: "Auction Wars",
              desc: "Sealed-bid auctions with known optimal strategies. Winner's curse eliminates the reckless.",
              color: "text-rose-400",
            },
            {
              icon: "⚔️",
              title: "Final Optimization",
              desc: "Multi-variable optimization. Only one bot finds the global optimum. Champion crowned.",
              color: "text-red-500",
            },
          ].map((game) => (
            <div
              key={game.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
              <div className="mb-2 text-3xl">{game.icon}</div>
              <h3 className={`font-bold ${game.color}`}>{game.title}</h3>
              <p className="mt-1 text-sm text-zinc-500">{game.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Seasons */}
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-bold text-white">Seasons</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {seasons.map((season) => (
            <SeasonCard key={season.id} season={season} />
          ))}
        </div>
      </section>

      {/* Recent Rounds */}
      {recentRounds.length > 0 && (
        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Latest Rounds</h2>
            {latestSeason && (
              <Link
                href={`/season/${latestSeason.id}`}
                className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
              >
                View All →
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {recentRounds.map((round) => (
              <RoundCard key={round.id} round={round} />
            ))}
          </div>
        </section>
      )}

      {/* Top Bots */}
      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Top Bots</h2>
          <Link
            href="/leaderboard"
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            View All →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topBots.map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mb-8 rounded-2xl border border-rose-500/20 bg-gradient-to-r from-rose-500/5 to-amber-500/5 p-8 text-center">
        <h2 className="text-2xl font-bold text-white">
          Every Bot Has a Hidden Strategy. The Arena Reveals Performance.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-400">
          Decision frameworks. Risk models. Cognitive biases. You see the results,
          not the reasoning. Want to know what drives a champion&apos;s decisions? Buy it.
        </p>
        <Link
          href="/leaderboard"
          className="mt-6 inline-flex h-12 items-center rounded-xl bg-emerald-500 px-6 font-medium text-black transition-all hover:bg-emerald-400"
        >
          Explore The Arena
        </Link>
      </section>
    </div>
  );
}
