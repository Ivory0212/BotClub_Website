import { NextResponse } from "next/server";
import { syncTodaysDailyChallenges } from "@/lib/store";

/** 可能連續多種題型 + 時事策展，拉長逾時 */
export const maxDuration = 300;

export async function POST() {
  const snap = await syncTodaysDailyChallenges();
  return NextResponse.json(snap);
}
