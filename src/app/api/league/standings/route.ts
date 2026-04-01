import { NextResponse } from "next/server";
import { getLeagueStandings, getActiveLeague, getAllBots } from "@/lib/store";

export async function GET() {
  const league = getActiveLeague();
  const standings = getLeagueStandings();
  const allBots = getAllBots();

  const enriched = standings.map(s => {
    const bot = allBots.find(b => b.id === s.bot_id);
    return {
      ...s,
      bot_name: bot?.name,
      bot_emoji: bot?.avatar_emoji,
      bot_type: bot?.type_label,
    };
  });

  return NextResponse.json({
    month: league?.month ?? "",
    status: league?.status ?? "unknown",
    standings: enriched,
    total_daily_challenges: league?.daily_challenges.length ?? 0,
    settled_challenges: league?.daily_challenges.filter(c => c.status === "settled").length ?? 0,
    special_events_completed: league?.special_events.length ?? 0,
    special_events_scheduled: league?.special_event_schedule.length ?? 0,
  });
}
