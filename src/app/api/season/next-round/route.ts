import { NextResponse } from "next/server";
import { runNextRound } from "@/lib/store";

export async function POST() {
  const result = runNextRound();

  if (!result) {
    return NextResponse.json(
      { error: "No active season or no more rounds to play" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    roundId: result.round.id,
    roundNumber: result.round.round_number,
    gameName: result.round.game_name,
    eliminated: result.round.eliminated_ids.length,
    survivors: result.round.survivor_count,
  });
}
