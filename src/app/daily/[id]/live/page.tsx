import { notFound } from "next/navigation";
import LiveEventReplay from "@/components/live/LiveEventReplay";
import { buildLiveDailyPayload } from "@/lib/viewer-sanitize";
import { getBotById, getDailyChallengeById } from "@/lib/store";

export default async function DailyLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDailyChallengeById(id);
  if (!row) return notFound();

  const payload = buildLiveDailyPayload(row.challenge, row.leagueMonth, getBotById);

  return (
    <LiveEventReplay
      title={payload.title}
      subtitle={payload.market_summary}
      gameType={payload.challenge_type}
      events={payload.events}
      bots={payload.bots}
      tracesByBotId={payload.tracesByBotId}
      backHref={`/daily/${id}`}
      backLabel="每日挑戰摘要"
    />
  );
}
