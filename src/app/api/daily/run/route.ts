import { NextRequest, NextResponse } from "next/server";
import { runDailyChallengeWithDetails } from "@/lib/store";
import type { DailyChallengeType } from "@/types";

/** 時事策展會多輪 tool + LLM，可能較久 */
export const maxDuration = 300;

const VALID_TYPES: DailyChallengeType[] = [
  "us_market",
  "tw_market",
  "crypto",
  "forex",
  "gold",
  "current_events",
];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { challengeType } = body as { challengeType?: string };

  if (!challengeType || !VALID_TYPES.includes(challengeType as DailyChallengeType)) {
    return NextResponse.json(
      { error: `Invalid challengeType. Must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const result = await runDailyChallengeWithDetails(challengeType as DailyChallengeType);

  if (!result.ok) {
    const softSkip = challengeType === "current_events";
    return NextResponse.json(
      {
        success: false,
        skipped: softSkip,
        reason: result.reason,
      },
      { status: softSkip ? 200 : 400 },
    );
  }

  const { challenge } = result;

  return NextResponse.json({
    success: true,
    challengeId: challenge.id,
    date: challenge.date,
    type: challenge.challenge_type,
    predictions: challenge.predictions.length,
    status: challenge.status,
    headline: challenge.event_topic?.headline,
  });
}
