import type { AgentDecisionTrace, Bot, DailyChallenge, GameEvent, Round, RoundParticipant } from "@/types";

/** Safe fields for LIVE / public viewer (no hidden persona). */
export interface PublicBotLive {
  id: string;
  name: string;
  avatar_emoji: string;
  type_label: string;
  rank?: number;
}

export function sanitizeBotLive(bot: Bot | undefined, fallbackId?: string): PublicBotLive {
  if (bot) {
    return {
      id: bot.id,
      name: bot.name,
      avatar_emoji: bot.avatar_emoji,
      type_label: bot.type_label,
      rank: bot.rank,
    };
  }
  return {
    id: fallbackId ?? "unknown",
    name: "Unknown",
    avatar_emoji: "🤖",
    type_label: "",
  };
}

export interface LiveRoundPayload {
  kind: "special_round";
  round_id: string;
  season_id: string;
  season_number: number;
  round_number: number;
  game_type: string;
  game_name: string;
  game_description: string;
  events: GameEvent[];
  participants: Array<{
    bot_id: string;
    bot: PublicBotLive;
    survived: boolean;
    score?: number;
    decision?: string;
    reasoning?: string;
    decision_trace?: AgentDecisionTrace;
  }>;
  challenge?: Round["challenge"];
}

export interface LiveDailyPayload {
  kind: "daily";
  challenge_id: string;
  league_month: string;
  date: string;
  challenge_type: string;
  title: string;
  events: GameEvent[];
  bots: PublicBotLive[];
  tracesByBotId: Record<string, AgentDecisionTrace | undefined>;
  market_summary?: string;
}

export function buildLiveRoundPayload(
  round: Round,
  seasonId: string,
  seasonNumber: number,
): LiveRoundPayload {
  return {
    kind: "special_round",
    round_id: round.id,
    season_id: seasonId,
    season_number: seasonNumber,
    round_number: round.round_number,
    game_type: round.game_type,
    game_name: round.game_name,
    game_description: round.game_description,
    events: round.events,
    participants: round.participants.map((p: RoundParticipant) => ({
      bot_id: p.bot_id,
      bot: sanitizeBotLive(p.bot, p.bot_id),
      survived: p.survived,
      score: p.score,
      decision: p.decision,
      reasoning: p.reasoning,
      decision_trace: p.decision_trace,
    })),
    challenge: round.challenge,
  };
}

export function buildLiveDailyPayload(
  challenge: DailyChallenge,
  leagueMonth: string,
  getBot: (id: string) => Bot | undefined,
): LiveDailyPayload {
  const tracesByBotId: Record<string, AgentDecisionTrace | undefined> = {};
  const bots: PublicBotLive[] = [];
  for (const pred of challenge.predictions) {
    tracesByBotId[pred.bot_id] = pred.decision_trace;
    const b = getBot(pred.bot_id);
    if (!bots.some((x) => x.id === pred.bot_id)) {
      bots.push(sanitizeBotLive(b, pred.bot_id));
    }
  }
  const typeLabel = challenge.challenge_type.replace(/_/g, " ").toUpperCase();
  const title =
    challenge.challenge_type === "current_events" && challenge.event_topic
      ? `每日 ${challenge.date} · 時事 · ${challenge.event_topic.headline}`
      : `每日 ${challenge.date} · ${typeLabel}`;
  const market_summary =
    challenge.challenge_type === "current_events" && challenge.event_topic
      ? `${challenge.event_topic.headline} · 截止 ${challenge.event_topic.resolution_deadline_iso}`
      : `${challenge.market_data.index_name} · 昨收 ${challenge.market_data.previous_close}`;
  return {
    kind: "daily",
    challenge_id: challenge.id,
    league_month: leagueMonth,
    date: challenge.date,
    challenge_type: challenge.challenge_type,
    title,
    events: challenge.events,
    bots,
    tracesByBotId,
    market_summary,
  };
}
