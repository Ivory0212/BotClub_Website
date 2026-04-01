import { NextResponse } from "next/server";
import { settleMonth } from "@/lib/store";

export async function POST() {
  const league = settleMonth();

  if (!league) {
    return NextResponse.json(
      { error: "No active league to settle" },
      { status: 400 },
    );
  }

  const top3 = league.hall_of_fame?.slice(0, 3) ?? [];
  const eliminatedCount = league.standings.length > 0
    ? Math.max(1, Math.floor(league.standings.length * 0.2))
    : 0;

  return NextResponse.json({
    success: true,
    month: league.month,
    status: league.status,
    hall_of_fame: top3.map(e => ({
      rank: e.rank,
      bot_name: e.bot_snapshot.name,
      bot_emoji: e.bot_snapshot.avatar_emoji,
      total_score: e.total_score,
      accuracy: e.accuracy,
      buyer_name: e.buyer_name,
    })),
    eliminated_count: eliminatedCount,
    total_participants: league.standings.length,
  });
}
