import HomeContent from "@/components/home/HomeContent";
import { getAllBots, getAllSeasons, getStats } from "@/lib/store";

export default function Home() {
  const bots = getAllBots();
  const topBots = bots.slice(0, 6);
  const seasons = getAllSeasons();
  const stats = getStats();
  const latestSeason = seasons[0];
  const recentRounds = latestSeason?.rounds.slice(-3).reverse() ?? [];

  return (
    <HomeContent
      topBots={topBots}
      seasons={seasons}
      stats={stats}
      latestSeason={latestSeason}
      recentRounds={recentRounds}
    />
  );
}
