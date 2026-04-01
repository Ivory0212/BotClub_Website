import { NextRequest, NextResponse } from "next/server";
import { runSpecialEvent } from "@/lib/store";
import type { GameType } from "@/types";

const VALID_TYPES: GameType[] = [
  "poker",
  "prisoners_dilemma",
  "market_forecast",
  "risk_assessment",
  "resource_allocation",
  "auction_wars",
];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { gameType } = body as { gameType?: string };

  if (!gameType || !VALID_TYPES.includes(gameType as GameType)) {
    return NextResponse.json(
      { error: `Invalid gameType. Must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const round = await runSpecialEvent(gameType as GameType);

  if (!round) {
    return NextResponse.json(
      { error: "No active league or not enough bots" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    roundId: round.id,
    gameType: round.game_type,
    gameName: round.game_name,
    participants: round.participants.length,
    events: round.events.length,
  });
}
