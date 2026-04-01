import { NextResponse } from "next/server";
import { buildLiveRoundPayload } from "@/lib/viewer-sanitize";
import { getRoundById } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const found = getRoundById(id);
  if (!found) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  const { season, round } = found;
  const payload = buildLiveRoundPayload(round, season.id, season.number);
  return NextResponse.json(payload);
}
