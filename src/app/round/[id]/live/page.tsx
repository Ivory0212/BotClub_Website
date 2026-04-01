import { notFound } from "next/navigation";
import LiveEventReplay from "@/components/live/LiveEventReplay";
import { buildLiveRoundPayload } from "@/lib/viewer-sanitize";
import { getRoundById } from "@/lib/store";

export default async function RoundLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = getRoundById(id);
  if (!found) return notFound();

  const { season, round } = found;
  const payload = buildLiveRoundPayload(round, season.id, season.number);
  const tracesByBotId = Object.fromEntries(
    payload.participants.map((p) => [p.bot_id, p.decision_trace]),
  );

  return (
    <LiveEventReplay
      title={payload.game_name}
      subtitle={`Season ${payload.season_number} · Round ${payload.round_number} · LIVE 回放`}
      gameType={payload.game_type}
      events={payload.events}
      bots={payload.participants.map((p) => p.bot)}
      tracesByBotId={tracesByBotId}
      backHref={`/round/${id}`}
      backLabel="回合詳情"
    />
  );
}
