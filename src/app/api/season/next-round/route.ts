import { NextResponse } from "next/server";
import { getActiveLeague, runNextRound } from "@/lib/store";

/** Special-event simulation can take a while when LLM is enabled for smaller bot counts. */
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    let seasonId: string | undefined;
    try {
      const body = (await req.json()) as { seasonId?: string };
      seasonId = typeof body?.seasonId === "string" ? body.seasonId : undefined;
    } catch {
      /* empty or non-JSON body */
    }

    if (seasonId) {
      const league = getActiveLeague();
      if (!league) {
        return NextResponse.json({ error: "目前沒有進行中的聯賽。" }, { status: 400 });
      }
      if (seasonId !== league.id) {
        return NextResponse.json(
          {
            error:
              "此頁面不是目前進行中的聯賽。請回首頁點選「Watch Current Season」後再執行回合。",
          },
          { status: 400 },
        );
      }
    }

    const result = await runNextRound();

    if (!result) {
      return NextResponse.json(
        {
          error:
            "沒有可執行的下一場特殊賽事（可能已全部跑完，或聯賽資料異常）。可改試 /api/special/run 或每日挑戰 API。",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      roundId: result.round.id,
      roundNumber: result.round.round_number,
      gameName: result.round.game_name,
      eliminated: result.round.eliminated_ids.length,
      survivors: result.round.survivor_count,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[api/season/next-round]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
