import { NextRequest, NextResponse } from "next/server";
import { purchaseBot } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { botId } = body;

  if (!botId) {
    return NextResponse.json({ error: "botId is required" }, { status: 400 });
  }

  const result = purchaseBot(botId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    bot: {
      id: result.bot!.id,
      name: result.bot!.name,
      hidden_persona: result.bot!.hidden_persona,
      hidden_strategy: result.bot!.hidden_strategy,
      hidden_background: result.bot!.hidden_background,
    },
  });
}
