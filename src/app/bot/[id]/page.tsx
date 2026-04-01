import { notFound } from "next/navigation";
import BotPageClient from "@/components/bot/BotPageClient";
import type { BotRoundRow } from "@/components/bot/BotPageClient";
import { getBotById, getAllSeasons } from "@/lib/store";

export default async function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bot = getBotById(id);

  if (!bot) return notFound();

  const seasons = getAllSeasons();
  const botRounds: BotRoundRow[] = [];
  for (const season of seasons) {
    for (const round of season.rounds) {
      const participant = round.participants.find((p) => p.bot_id === id);
      if (participant) {
        botRounds.push({
          seasonNum: season.number,
          roundNum: round.round_number,
          roundId: round.id,
          gameName: round.game_name,
          survived: participant.survived,
          score: participant.score,
          decision: participant.decision,
        });
      }
    }
  }

  return <BotPageClient bot={bot} botRounds={botRounds} />;
}
