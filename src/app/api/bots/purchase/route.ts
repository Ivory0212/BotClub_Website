import { NextRequest, NextResponse } from "next/server";
import { purchaseBot } from "@/lib/store";
import { isPreviewMode } from "@/lib/site-mode";

export async function POST(req: NextRequest) {
  if (isPreviewMode()) {
    return NextResponse.json(
      { error: "PREVIEW_MODE", message: "Purchases are disabled in preview." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { botId, buyerName } = body;

  if (!botId) {
    return NextResponse.json({ error: "botId is required" }, { status: 400 });
  }

  const result = purchaseBot(botId, buyerName);

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
