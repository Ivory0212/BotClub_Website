import { NextResponse } from "next/server";
import { buildLiveDailyPayload } from "@/lib/viewer-sanitize";
import { getBotById, getDailyChallengeById } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = getDailyChallengeById(id);
  if (!row) {
    return NextResponse.json({ error: "Daily challenge not found" }, { status: 404 });
  }
  const payload = buildLiveDailyPayload(row.challenge, row.leagueMonth, getBotById);
  return NextResponse.json(payload);
}
