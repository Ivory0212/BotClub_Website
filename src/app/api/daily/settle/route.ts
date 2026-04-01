import { NextRequest, NextResponse } from "next/server";
import { settleDailyChallengeById } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { challengeId } = body as { challengeId?: string };

  if (!challengeId) {
    return NextResponse.json(
      { error: "challengeId is required" },
      { status: 400 },
    );
  }

  const settled = await settleDailyChallengeById(challengeId);

  if (!settled) {
    return NextResponse.json(
      { error: "Challenge not found or no active league" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    challengeId: settled.id,
    status: settled.status,
    actualResult: settled.actual_result,
    eventResolution: settled.event_resolution,
    topScorer: settled.predictions
      .filter(p => p.score !== undefined)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0],
  });
}
