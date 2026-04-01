import { NextResponse } from "next/server";
import { getDailyTodaySnapshot } from "@/lib/store";

export async function GET() {
  const snap = getDailyTodaySnapshot();
  return NextResponse.json(snap);
}
