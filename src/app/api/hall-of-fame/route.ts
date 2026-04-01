import { NextResponse } from "next/server";
import { getHallOfFame } from "@/lib/store";

export async function GET() {
  const entries = getHallOfFame();

  const grouped: Record<string, typeof entries> = {};
  for (const entry of entries) {
    if (!grouped[entry.month]) grouped[entry.month] = [];
    grouped[entry.month].push(entry);
  }

  return NextResponse.json({
    total_entries: entries.length,
    months: Object.keys(grouped).sort().reverse(),
    entries: grouped,
  });
}
