import LeaderboardContent from "@/components/leaderboard/LeaderboardContent";
import { getAllBots } from "@/lib/store";

export default function LeaderboardPage() {
  const bots = getAllBots();
  return <LeaderboardContent bots={bots} />;
}
