import type {
  Bot,
  CuratedEventTopic,
  DailyChallenge,
  DailyChallengeType,
  DailyPrediction,
  EventResolution,
  GameEvent,
  MarketResult,
  MarketSnapshot,
  StockPick,
} from "@/types";
import { normalizeOutcomeKey, verifyEventOutcomeWithLLM } from "./daily-curator";
import { getMarketSnapshot, getMarketClose, US_STOCK_UNIVERSE, TW_STOCK_UNIVERSE, getTWStockName } from "./market-data";
import { getDailyMarketPrediction, getEventTopicPrediction, isLLMEnabled } from "./llm";

function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

const CHALLENGE_LABELS: Record<DailyChallengeType, string> = {
  us_market: "🇺🇸 S&P 500",
  tw_market: "🇹🇼 TAIEX",
  crypto: "₿ BTC/ETH",
  forex: "💱 USD/TWD",
  gold: "🥇 Gold (XAU)",
  current_events: "📰 時事／市場快題",
};

function getStockUniverse(type: DailyChallengeType): string[] {
  switch (type) {
    case "us_market": return US_STOCK_UNIVERSE;
    case "tw_market": return TW_STOCK_UNIVERSE;
    default: return [];
  }
}

function directionFromEventAnswer(
  answer: string,
  resolutionType: CuratedEventTopic["resolution_type"],
): "up" | "down" {
  const a = normalizeOutcomeKey(answer);
  if (resolutionType === "yes_no") return a === "no" ? "down" : "up";
  if (resolutionType === "up_down") return a === "down" ? "down" : "up";
  return "up";
}

function normalizeBotEventAnswer(raw: string, valid: string[]): string {
  const n = normalizeOutcomeKey(raw);
  const lowered = valid.map(normalizeOutcomeKey);
  const idx = lowered.indexOf(n);
  if (idx >= 0) return lowered[idx]!;
  return lowered[Math.floor(Math.random() * lowered.length)]!;
}

function generateRandomEventPrediction(bot: Bot, topic: CuratedEventTopic): DailyPrediction {
  const pick = topic.valid_outcomes[Math.floor(Math.random() * topic.valid_outcomes.length)]!;
  const event_answer = normalizeOutcomeKey(pick);
  return {
    bot_id: bot.id,
    direction: directionFromEventAnswer(event_answer, topic.resolution_type),
    predicted_change: 0,
    event_answer,
    reasoning: "隨機預測（LLM 未啟用或失敗）。",
    inner_thought: "資料不足，先猜一個選項。",
  };
}

// ─── RUN DAILY PREDICTIONS ─────────────────────────────────

type MarketDailyType = Exclude<DailyChallengeType, "current_events">;

export async function runDailyPredictions(
  leagueId: string,
  challengeType: MarketDailyType,
  bots: Bot[],
  date?: string,
): Promise<DailyChallenge> {
  const today = date ?? new Date().toISOString().split("T")[0];
  const events: GameEvent[] = [];
  const predictions: DailyPrediction[] = [];
  const useLLM = isLLMEnabled();

  let snapshot: MarketSnapshot;
  try {
    snapshot = await getMarketSnapshot(challengeType);
  } catch {
    snapshot = {
      index_name: CHALLENGE_LABELS[challengeType],
      previous_close: 0,
      context: "Market data unavailable — using fallback.",
    };
  }

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "analysis",
    content: `📊 Daily ${CHALLENGE_LABELS[challengeType]} prediction opened for ${today}.\n${snapshot.context}`,
  });

  const stockUniverse = getStockUniverse(challengeType);
  const hasStockPicks = challengeType === "us_market" || challengeType === "tw_market";

  for (const bot of bots) {
    if (bot.status === "eliminated" || bot.league_status === "eliminated") continue;

    let prediction: DailyPrediction;

    if (useLLM) {
      try {
        const result = await getDailyMarketPrediction(bot, snapshot, challengeType, stockUniverse);
        const parsed = typeof result.decision === "string" ? JSON.parse(`{${result.decision}}`) : {};

        const direction = (parsed.direction ?? result.reasoning?.toLowerCase().includes("down")) ? "down" as const : "up" as const;
        const predictedChange = typeof result.decision === "number"
          ? result.decision
          : (parsed.predicted_change ?? (Math.random() * 4 - 2));

        let stockPicks: StockPick[] | undefined;
        if (hasStockPicks && parsed.stock_picks?.length) {
          stockPicks = parsed.stock_picks.slice(0, 3).map((p: { symbol: string; name?: string; predicted_direction?: string; predicted_change?: number }) => ({
            symbol: p.symbol,
            name: p.name ?? (challengeType === "tw_market" ? getTWStockName(p.symbol) : p.symbol),
            predicted_direction: p.predicted_direction === "down" ? "down" as const : "up" as const,
            predicted_change: p.predicted_change ?? 0,
          }));
        }

        prediction = {
          bot_id: bot.id,
          direction: result.reasoning?.toLowerCase().includes("bearish") ? "down" : direction,
          predicted_change: Math.round(predictedChange * 100) / 100,
          stock_picks: stockPicks,
          reasoning: result.reasoning,
          inner_thought: result.inner_thought,
          decision_trace: result.trace,
        };

        for (const step of result.trace.steps) {
          if (step.type === "tool_call") {
            events.push({
              id: generateId(),
              timestamp: step.timestamp,
              type: "tool_call",
              actor_id: bot.id,
              actor_name: bot.name,
              content: `🔧 ${bot.avatar_emoji} ${bot.name} → ${step.tool_name}(${JSON.stringify(step.tool_input)})`,
            });
          } else if (step.type === "tool_result") {
            events.push({
              id: generateId(),
              timestamp: step.timestamp,
              type: "tool_result",
              actor_id: bot.id,
              actor_name: bot.name,
              content: `📋 ${bot.name}: ${(step.tool_output ?? "").slice(0, 120)}...`,
            });
          }
        }
      } catch (error) {
        console.error(`LLM prediction failed for ${bot.name}:`, error);
        prediction = generateRandomPrediction(bot, challengeType, stockUniverse);
      }
    } else {
      prediction = generateRandomPrediction(bot, challengeType, stockUniverse);
    }

    predictions.push(prediction);

    const picksText = prediction.stock_picks?.length
      ? ` | Picks: ${prediction.stock_picks.map(p => `${p.symbol}(${p.predicted_direction === "up" ? "↑" : "↓"}${p.predicted_change > 0 ? "+" : ""}${p.predicted_change}%)`).join(", ")}`
      : "";

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "decision",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `${bot.avatar_emoji} ${bot.name} predicts ${prediction.direction === "up" ? "📈 UP" : "📉 DOWN"} ${prediction.predicted_change >= 0 ? "+" : ""}${prediction.predicted_change}%${picksText}`,
    });

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "inner_thought",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `💭 ${bot.name}: "${prediction.inner_thought}"`,
    });
  }

  const bullishCount = predictions.filter(p => p.direction === "up").length;
  const bearishCount = predictions.filter(p => p.direction === "down").length;
  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "analysis",
    content: `📊 Consensus: ${bullishCount} bullish vs ${bearishCount} bearish. Avg predicted change: ${(predictions.reduce((s, p) => s + p.predicted_change, 0) / (predictions.length || 1)).toFixed(2)}%`,
  });

  return {
    id: `daily-${challengeType}-${today}-${generateId()}`,
    league_id: leagueId,
    date: today,
    challenge_type: challengeType,
    status: "locked",
    market_data: snapshot,
    predictions,
    events,
  };
}

// ─── CURRENT EVENTS (CURATOR TOPIC) ────────────────────────

export async function runEventDailyPredictions(
  leagueId: string,
  topic: CuratedEventTopic,
  bots: Bot[],
  date?: string,
): Promise<DailyChallenge> {
  const today = date ?? new Date().toISOString().split("T")[0];
  const events: GameEvent[] = [];
  const predictions: DailyPrediction[] = [];
  const useLLM = isLLMEnabled();

  const snapshot: MarketSnapshot = {
    index_name: `時事 · ${topic.headline.slice(0, 48)}${topic.headline.length > 48 ? "…" : ""}`,
    previous_close: 0,
    context: `${topic.news_anchors}\n\n── 題目 ──\n${topic.question_text}\n\n驗證方式：${topic.verification_plan}\n截止：${topic.resolution_deadline_iso}`,
  };

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "analysis",
    content: `📰 時事快題開跑：${topic.headline}\n策展信心 ${topic.curator_confidence}/100\n${topic.question_text}`,
  });

  for (const bot of bots) {
    if (bot.status === "eliminated" || bot.league_status === "eliminated") continue;

    let prediction: DailyPrediction;

    if (useLLM) {
      try {
        const result = await getEventTopicPrediction(bot, topic);
        const rawAnswer =
          typeof result.decision === "string"
            ? result.decision
            : String(result.trace?.final_decision ?? "");
        const event_answer = normalizeBotEventAnswer(rawAnswer, topic.valid_outcomes);

        prediction = {
          bot_id: bot.id,
          direction: directionFromEventAnswer(event_answer, topic.resolution_type),
          predicted_change: 0,
          event_answer,
          reasoning: result.reasoning,
          inner_thought: result.inner_thought,
          decision_trace: result.trace,
        };

        for (const step of result.trace.steps) {
          if (step.type === "tool_call") {
            events.push({
              id: generateId(),
              timestamp: step.timestamp,
              type: "tool_call",
              actor_id: bot.id,
              actor_name: bot.name,
              content: `🔧 ${bot.avatar_emoji} ${bot.name} → ${step.tool_name}(${JSON.stringify(step.tool_input)})`,
            });
          } else if (step.type === "tool_result") {
            events.push({
              id: generateId(),
              timestamp: step.timestamp,
              type: "tool_result",
              actor_id: bot.id,
              actor_name: bot.name,
              content: `📋 ${bot.name}: ${(step.tool_output ?? "").slice(0, 120)}...`,
            });
          }
        }
      } catch (error) {
        console.error(`Event topic LLM failed for ${bot.name}:`, error);
        prediction = generateRandomEventPrediction(bot, topic);
      }
    } else {
      prediction = generateRandomEventPrediction(bot, topic);
    }

    predictions.push(prediction);

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "decision",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `${bot.avatar_emoji} ${bot.name} → 選項【${prediction.event_answer}】`,
    });

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "inner_thought",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `💭 ${bot.name}: "${prediction.inner_thought}"`,
    });
  }

  return {
    id: `daily-current_events-${today}-${generateId()}`,
    league_id: leagueId,
    date: today,
    challenge_type: "current_events",
    status: "locked",
    market_data: snapshot,
    predictions,
    events,
    event_topic: topic,
  };
}

export function calculateEventScore(pred: DailyPrediction, resolution: EventResolution): number {
  if (normalizeOutcomeKey(pred.event_answer ?? "") !== normalizeOutcomeKey(resolution.outcome_key)) {
    return 0;
  }
  return 45;
}

export async function settleEventDailyChallenge(challenge: DailyChallenge): Promise<DailyChallenge> {
  if (challenge.status === "settled") return challenge;
  if (!challenge.event_topic) return challenge;

  const deadline = new Date(challenge.event_topic.resolution_deadline_iso).getTime();
  if (Number.isFinite(deadline) && Date.now() < deadline) {
    return challenge;
  }

  const v = await verifyEventOutcomeWithLLM(challenge);
  if (!v.ok) {
    return challenge;
  }

  const events = [...challenge.events];
  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "reveal",
    content: `✅ 驗題公佈：${v.resolution.outcome_label}（${v.resolution.outcome_key}）\n${v.resolution.verification_summary}`,
    is_dramatic: true,
  });

  const scoredPredictions = challenge.predictions.map((pred) => {
    const score = calculateEventScore(pred, v.resolution);
    const match =
      normalizeOutcomeKey(pred.event_answer ?? "") === normalizeOutcomeKey(v.resolution.outcome_key);
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "outcome",
      actor_id: pred.bot_id,
      content: `${match ? "✅" : "❌"} 預測【${pred.event_answer ?? "?"}】→ 結果【${v.resolution.outcome_key}】· ${score} 分`,
    });
    return { ...pred, score };
  });

  const sorted = [...scoredPredictions].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (sorted.length > 0 && sorted[0].score !== undefined) {
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "outcome",
      content: `🏆 本题最高分 Bot：${sorted[0].bot_id}（${sorted[0].score} 分）`,
      is_dramatic: true,
    });
  }

  return {
    ...challenge,
    status: "settled",
    event_resolution: v.resolution,
    predictions: scoredPredictions,
    events,
  };
}

// ─── SETTLE DAILY CHALLENGE ────────────────────────────────

export async function settleDailyChallenge(
  challenge: DailyChallenge,
): Promise<DailyChallenge> {
  if (challenge.status === "settled") return challenge;
  if (challenge.challenge_type === "current_events") {
    if (!challenge.event_topic) return challenge;
    return settleEventDailyChallenge(challenge);
  }

  let actualResult: MarketResult;
  try {
    actualResult = await getMarketClose(challenge.challenge_type);
  } catch {
    return challenge;
  }

  const events = [...challenge.events];

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "reveal",
    content: `🔔 Market closed! ${challenge.market_data.index_name} actual result: ${actualResult.direction === "up" ? "📈 UP" : "📉 DOWN"} ${actualResult.change_percent >= 0 ? "+" : ""}${actualResult.change_percent}% (Close: ${actualResult.close_price})`,
    is_dramatic: true,
  });

  const marketType = challenge.challenge_type as MarketDailyType;

  const scoredPredictions = challenge.predictions.map((pred) => {
    const score = calculateDailyScore(pred, actualResult, marketType);

    const dirCorrect = pred.direction === actualResult.direction;
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "outcome",
      actor_id: pred.bot_id,
      content: `${dirCorrect ? "✅" : "❌"} Bot predicted ${pred.direction} ${pred.predicted_change >= 0 ? "+" : ""}${pred.predicted_change}% → Actual: ${actualResult.direction} ${actualResult.change_percent >= 0 ? "+" : ""}${actualResult.change_percent}% | Score: ${score} pts`,
    });

    let updatedPicks = pred.stock_picks;
    if (updatedPicks?.length && actualResult.stock_results) {
      updatedPicks = updatedPicks.map(pick => {
        const actual = actualResult.stock_results?.[pick.symbol];
        if (actual !== undefined) {
          const correct = (pick.predicted_direction === "up" && actual >= 0) || (pick.predicted_direction === "down" && actual < 0);
          return { ...pick, actual_change: actual, correct };
        }
        return pick;
      });
    }

    return { ...pred, score, stock_picks: updatedPicks };
  });

  const sorted = [...scoredPredictions].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (sorted.length > 0 && sorted[0].score !== undefined) {
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "outcome",
      content: `🏆 Top scorer: Bot ${sorted[0].bot_id} with ${sorted[0].score} pts`,
      is_dramatic: true,
    });
  }

  return {
    ...challenge,
    status: "settled",
    actual_result: actualResult,
    predictions: scoredPredictions,
    events,
  };
}

// ─── SCORING ───────────────────────────────────────────────

export function calculateDailyScore(
  prediction: DailyPrediction,
  actual: MarketResult,
  challengeType: MarketDailyType,
): number {
  let score = 0;

  if (prediction.direction === actual.direction) {
    score += 10;
  }

  const diff = Math.abs(prediction.predicted_change - actual.change_percent);
  if (diff <= 0.5) {
    score += 20;
  } else if (diff <= 1.0) {
    score += 10;
  } else if (diff <= 2.0) {
    score += 5;
  }

  if ((challengeType === "us_market" || challengeType === "tw_market") && prediction.stock_picks?.length && actual.stock_results) {
    for (const pick of prediction.stock_picks) {
      const actualChange = actual.stock_results[pick.symbol];
      if (actualChange !== undefined) {
        const pickCorrect = (pick.predicted_direction === "up" && actualChange >= 0) || (pick.predicted_direction === "down" && actualChange < 0);
        if (pickCorrect) score += 5;
      }
    }
  }

  const maxPossible = 10 + 20 + (prediction.stock_picks?.length ? 15 : 0);
  if (score >= maxPossible) {
    score += 10;
  }

  return score;
}

// ─── SCHEDULE HELPERS ──────────────────────────────────────

export function getDailyChallengeSchedule(dayOfWeek: number): DailyChallengeType[] {
  const schedules: Record<number, DailyChallengeType[]> = {
    1: ["us_market", "tw_market", "crypto", "current_events"],
    2: ["us_market", "tw_market", "forex"],
    3: ["us_market", "tw_market", "gold", "current_events"],
    4: ["us_market", "tw_market", "crypto"],
    5: ["us_market", "tw_market", "forex", "current_events"],
  };
  return schedules[dayOfWeek] ?? ["crypto"];
}

// ─── RANDOM PREDICTION (fallback) ──────────────────────────

function generateRandomPrediction(
  bot: Bot,
  challengeType: DailyChallengeType,
  stockUniverse: string[],
): DailyPrediction {
  const direction: "up" | "down" = Math.random() > 0.5 ? "up" : "down";
  const magnitude = Math.round((Math.random() * 3 + 0.1) * 100) / 100;
  const change = direction === "up" ? magnitude : -magnitude;

  const hasStockPicks = challengeType === "us_market" || challengeType === "tw_market";
  let stockPicks: StockPick[] | undefined;

  if (hasStockPicks && stockUniverse.length >= 3) {
    const shuffled = [...stockUniverse].sort(() => Math.random() - 0.5);
    stockPicks = shuffled.slice(0, 3).map(sym => ({
      symbol: sym,
      name: challengeType === "tw_market" ? getTWStockName(sym) : sym,
      predicted_direction: (Math.random() > 0.5 ? "up" : "down") as "up" | "down",
      predicted_change: Math.round((Math.random() * 4 - 1) * 100) / 100,
    }));
  }

  const templates = [
    { r: "Based on technical indicators and market momentum analysis.", t: "The current trend suggests this direction but I'm not fully confident." },
    { r: "Fundamental analysis of recent economic data and sector rotation.", t: "Macro conditions are mixed. Taking a moderate stance." },
    { r: "Analyzing volume patterns and institutional flow data.", t: "Smart money seems to be positioning this way. Following the flow." },
    { r: "Mean reversion model suggests current levels are overextended.", t: "Markets usually correct after large moves. Betting on reversion." },
  ];
  const tmpl = templates[Math.floor(Math.random() * templates.length)];

  return {
    bot_id: bot.id,
    direction,
    predicted_change: change,
    stock_picks: stockPicks,
    reasoning: tmpl.r,
    inner_thought: tmpl.t,
  };
}
