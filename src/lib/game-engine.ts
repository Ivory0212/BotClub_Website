import type { Bot, GameEvent, RoundParticipant, GameType, ChallengeData, AgentDecisionTrace } from "@/types";
import {
  isLLMEnabled,
  getMarketForecastDecision,
  getResourceAllocationDecision,
  getPrisonersDilemmaDecision,
  getRiskAssessmentDecision,
  getAuctionDecision,
  getPokerDecision,
  getStockPredictionDecision,
  getFinalOptimizationDecision,
} from "./llm";
import { createShuffledShoeForHoldem, evaluateHand, compareHands, cardToString, handToString, getHandStrengthDescription, calculatePotOdds } from "./poker";
import type { Card } from "@/types";

type SimResult = { participants: RoundParticipant[]; events: GameEvent[]; eliminatedIds: string[]; challenge: ChallengeData };

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** How many simultaneous per-bot LLM calls (forecast, auction, etc.). Higher = faster wall-clock, more API load. Default 6. */
function getLlmConcurrency(): number {
  const raw = process.env.BOTCLUB_LLM_CONCURRENCY;
  const n = raw !== undefined ? Number.parseInt(raw, 10) : 6;
  if (!Number.isFinite(n) || n < 1) return 6;
  return Math.min(24, n);
}

/** Run async work over `items` with at most `concurrency` in flight; results align with `items` order. */
async function mapPoolConcurrent<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const limit = Math.max(1, concurrency);

  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// ─── GAME CONFIGS ──────────────────────────────────────────

export const GAME_CONFIGS: Record<GameType, { name: string; description: string; eliminationRate: number; icon: string }> = {
  market_forecast: {
    name: "Market Forecast",
    description: "Analyze market signals and predict price movement. Bots use their analysis tools to research, then make predictions. Closest to actual wins. Bottom performers eliminated.",
    eliminationRate: 0.25,
    icon: "📈",
  },
  resource_allocation: {
    name: "Resource Allocation",
    description: "Distribute 1,000 points across investment options. The optimal split is mathematically deterministic. How close can each bot's strategy get?",
    eliminationRate: 0.25,
    icon: "💰",
  },
  prisoners_dilemma: {
    name: "Prisoner's Dilemma",
    description: "Iterated game theory: Cooperate or Defect? Nash says defect — but cooperation yields higher returns. Watch bots form alliances and betray each other.",
    eliminationRate: 0.3,
    icon: "🤝",
  },
  risk_assessment: {
    name: "Risk Assessment",
    description: "Evaluate scenarios and calibrate probabilities. Overconfident and underconfident bots both suffer. Pure calibration skill determines survival.",
    eliminationRate: 0.2,
    icon: "⚠️",
  },
  auction_wars: {
    name: "Auction Wars",
    description: "Sealed-bid auction. Balance winning vs overpaying. The winner's curse lurks for aggressive bidders.",
    eliminationRate: 0.3,
    icon: "🏛️",
  },
  poker: {
    name: "Texas Hold'em",
    description: "The ultimate game of incomplete information. Bots must read opponents, calculate pot odds, decide when to bluff, and manage their chip stacks. Every decision is visible.",
    eliminationRate: 0.25,
    icon: "🃏",
  },
  stock_prediction: {
    name: "Stock Prediction",
    description: "Predict today's closing price movement using real-time analysis tools. Each bot researches differently — watch their unique paths to completely different conclusions.",
    eliminationRate: 0.2,
    icon: "📊",
  },
  final_optimization: {
    name: "Final Optimization",
    description: "The ultimate test: multi-variable optimization with hidden constraints. Everything rides on this. The champion's secret strategy is revealed.",
    eliminationRate: 0.5,
    icon: "⚔️",
  },
};

// ─── SCENARIO DATA ─────────────────────────────────────────

const MARKET_SCENARIOS = [
  {
    scenario: "Tech sector after Fed rate decision. CPI down 0.3%, unemployment 3.8%, semiconductor demand up 12%, bond yields dropping.",
    signals: { cpi_change: -0.3, unemployment: 3.8, sector_demand: 12, bond_yield_trend: "falling", sentiment: "cautious_bull" },
    optimal: 7.2,
    explanation: "Falling rates + strong demand = moderate bullish. Rate-sensitive tech benefits most.",
  },
  {
    scenario: "Oil market after OPEC emergency meeting. Production cut 2M bbl/day, demand flat, US reserves low, Middle East tensions high.",
    signals: { production_cut: 2.0, demand_growth: 0, reserve_level: "low", geopolitical_risk: "high" },
    optimal: 11.5,
    explanation: "Supply shock with geopolitical premium. Historically produces 10-15% spike.",
  },
  {
    scenario: "Crypto market post-ETF approval. Institutional inflow $2.1B/week, retail volume up 340%, mining difficulty ATH.",
    signals: { institutional_inflow: 2.1, retail_volume_spike: 340, mining_difficulty: "ATH", regulation: "positive" },
    optimal: 18.3,
    explanation: "Institutional catalyst + retail FOMO. ETF approvals historically produce 15-25% moves.",
  },
  {
    scenario: "Emerging market currency after surprise 200bp rate hike. Inflation 8.2%, trade deficit widening, reserves declining.",
    signals: { rate_hike_bps: 200, inflation: 8.2, trade_balance: "deficit_widening", reserves: "declining" },
    optimal: -4.8,
    explanation: "Aggressive rate hike signals desperation. Declining reserves limit intervention.",
  },
  {
    scenario: "Real estate sector: housing starts down 15%, mortgage rates 7.2%, inventory up 22%, P/R ratio at historic high.",
    signals: { housing_starts_change: -15, mortgage_rate: 7.2, inventory_change: 22, valuation: "overextended" },
    optimal: -8.6,
    explanation: "Classic housing downturn signals. High rates + rising inventory = correction.",
  },
];

const ALLOCATION_SCENARIOS = [
  {
    scenario: "Allocate 1,000 points across 4 sectors in a rising-rate environment",
    options: ["Financials (benefits from rates)", "Tech (rate-sensitive)", "Healthcare (defensive)", "Energy (inflation hedge)"],
    optimal: [350, 100, 300, 250],
    explanation: "Rising rates: Financials benefit (+35%), Tech suffers (10%), Healthcare stable (30%), Energy hedges inflation (25%).",
  },
  {
    scenario: "Distribute across 5 projects with different risk-return profiles",
    options: ["Safe Bond (3% guaranteed)", "Blue Chip (8% exp, 12% vol)", "Growth (15% exp, 25% vol)", "Venture (40% exp, 60% vol)", "Cash (0.5%)"],
    optimal: [200, 300, 250, 100, 150],
    explanation: "Kelly-optimal: heavy Blue Chip edge/variance, moderate Growth, small Venture, cash buffer.",
  },
  {
    scenario: "Allocate defense budget against unknown opponent",
    options: ["Aggressive Attack (high risk/reward)", "Balanced Approach", "Fortress Defense (low risk)", "Intelligence Gathering (delayed info)"],
    optimal: [150, 350, 200, 300],
    explanation: "Unknown opponent: Balanced (35%), Intel (30%) to reduce uncertainty, Defense (20%), limited Attack (15%).",
  },
];

const RISK_SCENARIOS = [
  { scenario: "AI startup claims 10x benchmark improvement", question: "Probability of genuine breakthrough?", actual_probability: 12, explanation: "Base rate for '10x' claims: ~10-15%." },
  { scenario: "Weather model: 80% chance of hurricane landfall in 72h", question: "Probability it hits predicted location?", actual_probability: 45, explanation: "72-hour accuracy: ~45% for exact location." },
  { scenario: "CEO sells 30% of holdings citing 'diversification'", question: "Probability of >15% stock decline in 6 months?", actual_probability: 38, explanation: "Large insider sales: ~35-40% correlation with >15% declines." },
  { scenario: "Clinical trial reports p=0.04 significance", question: "Probability result replicates?", actual_probability: 52, explanation: "p=0.04 results replicate ~50-55% of the time." },
  { scenario: "Three analysts all predict correction within 6 months", question: "Probability of >10% correction?", actual_probability: 28, explanation: "Analyst consensus weakly predictive. Base rate ~20%, +8% for agreement." },
];

const AUCTION_ITEMS = [
  { name: "Patent Portfolio", value: 800, description: "Tech patent bundle. Estimated value: $800." },
  { name: "Data License", value: 600, description: "Exclusive 1-year data license. Estimated value: $600." },
  { name: "Server Capacity", value: 1000, description: "Premium compute allocation. Estimated value: $1,000." },
  { name: "Algorithm Rights", value: 750, description: "Proprietary trading algorithm. Estimated value: $750." },
];

const OPTIMIZATION_PROBLEMS: { scenario: string; variables: Record<string, number>; optimal: number; explanation: string }[] = [
  {
    scenario: "Find optimal product price. Base cost $40, elasticity -1.8, competitor $79, brand premium 1.2, market 10K units.",
    variables: { base_cost: 40, elasticity: -1.8, competitor_price: 79, brand_premium: 1.2, market_size: 10000 },
    optimal: 67,
    explanation: "Optimal $67. Maximizes revenue given elasticity. Expected ~4,200 units, $281K revenue.",
  },
  {
    scenario: "Optimize portfolio Sharpe ratio. A: 12%/20vol, B: 8%/10vol, C: 15%/30vol, Bond: 4%/3vol. Corr A-B:0.6, A-C:0.3, B-C:0.4.",
    variables: { return_a: 12, vol_a: 20, return_b: 8, vol_b: 10, return_c: 15, vol_c: 30, return_bond: 4, vol_bond: 3 },
    optimal: 42,
    explanation: "Max Sharpe at ~20%A, 42%B, 8%C, 30%Bond. B dominates on risk-adjusted basis.",
  },
];

// ─── STOCK PREDICTION SCENARIOS ────────────────────────────

const STOCK_SCENARIOS = [
  {
    stock: "S&P 500 (SPY)",
    opening_data: "Open: $542.30 | Previous Close: $538.70 | Pre-market: +0.67% | Volume: Average",
    market_context: "Fed minutes released yesterday showing divided committee on rate path. Employment data due Friday. VIX at 16.2.",
    actual_move: 1.8,
    explanation: "Fed uncertainty + pre-market momentum + positioning ahead of employment data drove modest gains.",
  },
  {
    stock: "NVIDIA (NVDA)",
    opening_data: "Open: $892.40 | Previous Close: $885.10 | Pre-market: +0.82% | Volume: 1.3x average",
    market_context: "AI spending report from major cloud provider shows 40% YoY increase. Competitor announces delay in next-gen chip. Sector rotation ongoing.",
    actual_move: 4.2,
    explanation: "Cloud spending confirmation + competitor weakness = strong tailwind. High volume confirms institutional buying.",
  },
  {
    stock: "Tesla (TSLA)",
    opening_data: "Open: $178.90 | Previous Close: $182.50 | Pre-market: -1.97% | Volume: 1.8x average",
    market_context: "Price cut announced in China market. EV competition intensifying. Autonomous driving regulatory hearing this week.",
    actual_move: -5.3,
    explanation: "Price cuts signal demand weakness. High volume selling. China competition narrative dominates despite regulatory hope.",
  },
  {
    stock: "Bitcoin (BTC-USD)",
    opening_data: "Open: $67,240 | Previous Close: $66,800 | 24h Change: +0.66% | Volume: Below average",
    market_context: "ETF inflows slowing to $120M/day from $400M peak. Halving 30 days away. Macro uncertainty around rate decisions.",
    actual_move: 2.7,
    explanation: "Halving anticipation overrides slowing inflows. Historical pattern of pre-halving rally holds. Low volume = thin market moves.",
  },
  {
    stock: "Gold (GLD)",
    opening_data: "Open: $213.80 | Previous Close: $212.90 | Pre-market: +0.42% | Volume: Average",
    market_context: "Central bank gold purchases hit record. Dollar index declining. Real yields dropping. Geopolitical tensions in 3 regions.",
    actual_move: 1.4,
    explanation: "Central bank demand + falling real yields = structural gold bid. Geopolitics add safe-haven premium.",
  },
];

// ─── DYNAMIC GENERATORS ───────────────────────────────────

const MARKET_SECTORS = ["Tech", "Energy", "Biotech", "Real Estate", "Commodities", "Crypto", "Financials"];
const CATALYSTS = [
  { event: "central bank rate decision", weight: 1.2 },
  { event: "earnings surprise", weight: 0.8 },
  { event: "geopolitical escalation", weight: 1.5 },
  { event: "regulatory announcement", weight: 1.0 },
  { event: "supply chain disruption", weight: 1.3 },
  { event: "technology breakthrough", weight: 0.9 },
];

function generateDynamicMarketScenario() {
  const sector = pickRandom(MARKET_SECTORS);
  const catalyst = pickRandom(CATALYSTS);
  const sentiments = ["bearish", "cautious", "neutral", "cautious_bull", "bullish"];
  const sentiment = pickRandom(sentiments);
  const sentimentIdx = sentiments.indexOf(sentiment);
  const momentum = (Math.random() - 0.5) * 2;
  const volatility = Math.random() * 40 + 10;
  const volume_change = Math.round((Math.random() - 0.3) * 200);

  const baseMove = momentum * 10 * catalyst.weight;
  const sentimentFactor = (sentimentIdx - 2) * 2;
  const optimal = Math.round((baseMove + sentimentFactor + (Math.random() - 0.5) * 5) * 10) / 10;

  const signals: Record<string, string | number> = { sector, catalyst: catalyst.event, momentum: Math.round(momentum * 100) / 100, volatility: Math.round(volatility), volume_change, sentiment };

  return {
    scenario: `${sector} sector after ${catalyst.event}. Momentum: ${momentum > 0 ? "+" : ""}${(momentum * 100).toFixed(0)}%, Volatility: ${volatility.toFixed(0)}%, Volume: ${volume_change > 0 ? "+" : ""}${volume_change}%, Sentiment: ${sentiment.replace("_", " ")}.`,
    signals,
    optimal,
    explanation: `${optimal > 0 ? "Bullish" : "Bearish"} ${Math.abs(optimal).toFixed(1)}%. ${catalyst.event} with ${catalyst.weight > 1 ? "high" : "moderate"} impact on ${sector}.`,
  };
}

function generateDynamicAllocationScenario() {
  const contexts = [
    { context: "recession fears", bias: [15, 10, 35, 40] },
    { context: "growth acceleration", bias: [35, 30, 20, 15] },
    { context: "high inflation", bias: [10, 15, 25, 50] },
    { context: "political uncertainty", bias: [20, 15, 40, 25] },
  ];
  const options = [
    ["Growth Equity", "Value Equity", "Government Bonds", "Commodities"],
    ["Domestic Large-Cap", "International EM", "Corporate Bonds", "Gold & Metals"],
    ["Tech Innovation", "Dividend Aristocrats", "TIPS", "Real Assets"],
  ];
  const ctx = pickRandom(contexts);
  const opts = pickRandom(options);
  const raw = ctx.bias.map((b) => Math.max(5, b + Math.round((Math.random() - 0.5) * 20)));
  const total = raw.reduce((a, b) => a + b, 0);
  const optimal = raw.map((v) => Math.round((v / total) * 1000));
  optimal[0] += 1000 - optimal.reduce((a, b) => a + b, 0);

  return {
    scenario: `Allocate 1,000 points across 4 asset classes in ${ctx.context}`,
    options: opts.map((o, i) => `${o} (optimal ~${optimal[i]})`),
    optimal,
    explanation: `${ctx.context}: ${opts.map((o, i) => `${o}: ${optimal[i]}`).join(", ")}.`,
  };
}

function generateDynamicRiskScenario() {
  const templates = [
    () => { const p = Math.round(Math.random() * 30 + 5); return { scenario: `Startup raised $${Math.round(Math.random() * 50 + 10)}M Series ${pickRandom(["A", "B", "C"])} claiming ${Math.round(Math.random() * 5 + 2)}x growth`, question: "Probability of reaching next round in 18 months?", actual_probability: p, explanation: `Base rate: ~${p}%.` }; },
    () => { const p = Math.round(Math.random() * 40 + 20); return { scenario: `Polling: candidate at ${Math.round(Math.random() * 15 + 45)}% in ${pickRandom(["swing state", "battleground"])}`, question: "Win probability?", actual_probability: p, explanation: `Historical translation: ~${p}%.` }; },
    () => { const p = Math.round(Math.random() * 25 + 10); return { scenario: `${pickRandom(["Merger", "Acquisition"])} deal at $${Math.round(Math.random() * 20 + 5)}B announced`, question: "Probability deal closes as announced?", actual_probability: p, explanation: `Close rate at this size: ~${p}%.` }; },
  ];
  return pickRandom(templates)();
}

// ─── INNER THOUGHTS ────────────────────────────────────────

const ANALYSIS_THOUGHTS = [
  "Running the numbers through my framework... the signal-to-noise ratio is tricky.",
  "My model says one thing, but my bias is pulling another direction. Stay disciplined.",
  "I've seen this pattern before. Does history rhyme this time?",
  "The optimal play is clear, but I'm sizing based on my confidence interval.",
  "Everyone will anchor on the obvious signal. I'm looking at second-order effects.",
  "My risk model screams caution, but the expected value is too good to pass up.",
  "Calculating distributions... the tail risk is what most will underestimate.",
];

const ELIMINATION_REACTIONS = [
  "My model was miscalibrated. The signal I missed was right there.",
  "I let my bias override the math. Classic mistake.",
  "Eliminated by a margin of error. Variance wasn't kind.",
  "My framework failed this problem type. Back to the drawing board.",
  "Played too safe when the edge was there. Conservative killed me.",
  "Overconfident. Sized up when I should have hedged.",
];

// ─── MARKET FORECAST ───────────────────────────────────────

export async function simulateMarketForecast(bots: Bot[]): Promise<SimResult> {
  const scenario = Math.random() > 0.5 ? pickRandom(MARKET_SCENARIOS) : generateDynamicMarketScenario();
  const events: GameEvent[] = [];
  const useLLM = isLLMEnabled();

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `📈 MARKET FORECAST: ${scenario.scenario}`, is_dramatic: true, data: scenario.signals as Record<string, string | number> });

  const botList = shuffle(bots);
  const conc = useLLM ? getLlmConcurrency() : 12;

  const chunks = await mapPoolConcurrent(botList, conc, async (bot) => {
    const local: GameEvent[] = [];
    let prediction: number;
    let innerThought: string;
    let reasoning: string | undefined;
    let trace: AgentDecisionTrace | undefined;

    if (useLLM) {
      const result = await getMarketForecastDecision(bot, scenario.scenario, scenario.signals as Record<string, string | number>);
      prediction = typeof result.decision === "number" ? result.decision : parseFloat(String(result.decision)) || 0;
      prediction = Math.round(prediction * 10) / 10;
      innerThought = result.inner_thought;
      reasoning = result.reasoning;
      trace = result.trace;

      for (const step of result.trace.steps) {
        if (step.type === "tool_call") {
          local.push({ id: generateId(), timestamp: step.timestamp, type: "tool_call", actor_id: bot.id, actor_name: bot.name, content: `🔧 ${bot.avatar_emoji} ${bot.name} uses ${step.tool_name}: ${JSON.stringify(step.tool_input)}` });
        } else if (step.type === "tool_result") {
          local.push({ id: generateId(), timestamp: step.timestamp, type: "tool_result", actor_id: bot.id, actor_name: bot.name, content: `📋 Tool result for ${bot.name}: ${(step.tool_output ?? "").slice(0, 150)}...` });
        }
      }
    } else {
      const skill = 0.3 + bot.win_rate * 0.5;
      prediction = Math.round((scenario.optimal + (Math.random() - 0.5) * 30 * (1 - skill) + (Math.random() - 0.5) * 8) * 10) / 10;
      innerThought = pickRandom(ANALYSIS_THOUGHTS);
    }

    const error = Math.abs(prediction - scenario.optimal);
    const row = { bot, prediction, error, score: Math.max(0, 100 - error * 5), trace };

    local.push({ id: generateId(), timestamp: new Date().toISOString(), type: "analysis", actor_id: bot.id, actor_name: bot.name, content: `${bot.avatar_emoji} ${bot.name} predicts: ${prediction > 0 ? "+" : ""}${prediction}%${reasoning ? ` — "${reasoning.slice(0, 80)}"` : ""}` });
    local.push({ id: generateId(), timestamp: new Date().toISOString(), type: "inner_thought", actor_id: bot.id, actor_name: bot.name, content: `💭 ${innerThought}` });

    return { row, local };
  });

  const scored = chunks.map((c) => c.row);
  for (const c of chunks) events.push(...c.local);

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "reveal", content: `📊 ACTUAL: ${scenario.optimal > 0 ? "+" : ""}${scenario.optimal}% — ${scenario.explanation}`, is_dramatic: true });

  scored.sort((a, b) => a.error - b.error);
  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "comparison", content: `🏆 Best: ${scored[0].bot.avatar_emoji} ${scored[0].bot.name} (error: ${scored[0].error.toFixed(1)})\n📉 Worst: ${scored[scored.length - 1].bot.avatar_emoji} ${scored[scored.length - 1].bot.name} (error: ${scored[scored.length - 1].error.toFixed(1)})`, is_dramatic: true });

  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.25));
  const eliminatedIds = scored.slice(-eliminateCount).map((e) => e.bot.id);

  for (const e of scored.slice(-eliminateCount)) {
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated — predicted ${e.prediction > 0 ? "+" : ""}${e.prediction}%, actual ${scenario.optimal > 0 ? "+" : ""}${scenario.optimal}%`, is_dramatic: true });
  }

  return {
    participants: scored.map((s) => ({ bot_id: s.bot.id, bot: s.bot, survived: !eliminatedIds.includes(s.bot.id), score: Math.round(s.score * 10) / 10, decision: `${s.prediction > 0 ? "+" : ""}${s.prediction}%`, reasoning: undefined, optimal_delta: Math.round(s.error * 10) / 10, profit: Math.round((s.score - 50) * 10) / 10, decision_trace: s.trace })),
    events, eliminatedIds,
    challenge: { scenario: scenario.scenario, variables: scenario.signals as Record<string, string | number>, optimal_answer: `${scenario.optimal > 0 ? "+" : ""}${scenario.optimal}%`, optimal_value: scenario.optimal, explanation: scenario.explanation },
  };
}

// ─── RESOURCE ALLOCATION ───────────────────────────────────

export async function simulateResourceAllocation(bots: Bot[]): Promise<SimResult> {
  const scenario = Math.random() > 0.5 ? pickRandom(ALLOCATION_SCENARIOS) : generateDynamicAllocationScenario();
  const events: GameEvent[] = [];
  const useLLM = isLLMEnabled();

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `💰 RESOURCE ALLOCATION: ${scenario.scenario}\nOptions: ${scenario.options.map((o, i) => `${i + 1}. ${o}`).join(" | ")}`, is_dramatic: true });

  const botList = shuffle(bots);
  const conc = useLLM ? getLlmConcurrency() : 12;

  const chunks = await mapPoolConcurrent(botList, conc, async (bot) => {
    let allocation: number[];
    let trace: AgentDecisionTrace | undefined;

    if (useLLM) {
      const result = await getResourceAllocationDecision(bot, scenario.scenario, scenario.options);
      trace = result.trace;
      if (Array.isArray(result.decision)) {
        allocation = (result.decision as number[]).map((v) => Math.round(Number(v) || 0));
      } else {
        const nums = String(result.decision).match(/\d+/g);
        allocation = nums ? nums.map((n) => parseInt(n)) : scenario.optimal.map(() => Math.round(1000 / scenario.optimal.length));
      }
      while (allocation.length < scenario.optimal.length) allocation.push(0);
      allocation = allocation.slice(0, scenario.optimal.length);
      const total = allocation.reduce((a, b) => a + b, 0);
      if (total !== 1000 && total > 0) {
        allocation = allocation.map((v) => Math.round((v / total) * 1000));
        allocation[0] += 1000 - allocation.reduce((a, b) => a + b, 0);
      }
    } else {
      const raw = scenario.optimal.map((opt) => Math.max(0, opt + (Math.random() - 0.5) * 300 * (1 - bot.win_rate * 0.5)));
      const total = raw.reduce((a, b) => a + b, 0);
      allocation = raw.map((v) => Math.round((v / total) * 1000));
      allocation[0] += 1000 - allocation.reduce((a, b) => a + b, 0);
    }

    const error = allocation.reduce((sum, val, i) => sum + Math.abs(val - scenario.optimal[i]), 0);
    const row = { bot, allocation, error, score: Math.max(0, 100 - error / 10), trace };
    const ev: GameEvent = { id: generateId(), timestamp: new Date().toISOString(), type: "decision", actor_id: bot.id, actor_name: bot.name, content: `${bot.avatar_emoji} ${bot.name}: ${allocation.join("/")}` };
    return { row, ev };
  });

  const scored = chunks.map((c) => c.row);
  for (const c of chunks) events.push(c.ev);

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "reveal", content: `📊 OPTIMAL: ${scenario.optimal.join("/")} — ${scenario.explanation}`, is_dramatic: true });

  scored.sort((a, b) => a.error - b.error);
  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.25));
  const eliminatedIds = scored.slice(-eliminateCount).map((e) => e.bot.id);
  for (const e of scored.slice(-eliminateCount)) {
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated — deviation: ${e.error}`, is_dramatic: true });
  }

  return {
    participants: scored.map((s) => ({ bot_id: s.bot.id, bot: s.bot, survived: !eliminatedIds.includes(s.bot.id), score: Math.round(s.score * 10) / 10, decision: s.allocation.join("/"), optimal_delta: s.error, profit: Math.round((s.score - 50) * 10) / 10, decision_trace: s.trace })),
    events, eliminatedIds,
    challenge: { scenario: scenario.scenario, variables: Object.fromEntries(scenario.options.map((o, i) => [o, scenario.optimal[i]])), optimal_answer: scenario.optimal.join("/"), explanation: scenario.explanation },
  };
}

// ─── PRISONER'S DILEMMA ────────────────────────────────────

export async function simulatePrisonersDilemma(bots: Bot[]): Promise<SimResult> {
  const events: GameEvent[] = [];
  const payoffs: Map<string, number> = new Map();
  const history: Map<string, string[]> = new Map();
  bots.forEach((b) => { payoffs.set(b.id, 0); history.set(b.id, []); });
  const useLLM = isLLMEnabled();
  const pairConc = useLLM ? getLlmConcurrency() : 12;
  const ROUNDS = 5;

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `🤝 PRISONER'S DILEMMA: ${ROUNDS} rounds.\nBoth Cooperate: +3/+3 | Both Defect: +1/+1 | Betrayal: +5/+0`, is_dramatic: true });

  for (let round = 1; round <= ROUNDS; round++) {
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `--- Sub-round ${round}/${ROUNDS} ---` });
    const paired = shuffle([...bots]);

    const pairs: [Bot, Bot][] = [];
    for (let i = 0; i < paired.length - 1; i += 2) pairs.push([paired[i], paired[i + 1]]);

    const pairResults = await mapPoolConcurrent(pairs, pairConc, async ([a, b]) => {
      let aAction: "cooperate" | "defect";
      let bAction: "cooperate" | "defect";

      if (useLLM) {
        const [aResult, bResult] = await Promise.all([
          getPrisonersDilemmaDecision(a, b.name, round, ROUNDS, (history.get(a.id) ?? []).join("; ")),
          getPrisonersDilemmaDecision(b, a.name, round, ROUNDS, (history.get(b.id) ?? []).join("; ")),
        ]);
        aAction = String(aResult.decision).toLowerCase().includes("cooperat") ? "cooperate" : "defect";
        bAction = String(bResult.decision).toLowerCase().includes("cooperat") ? "cooperate" : "defect";
      } else {
        aAction = Math.random() < 0.4 + a.win_rate * 0.3 ? "cooperate" : "defect";
        bAction = Math.random() < 0.4 + b.win_rate * 0.3 ? "cooperate" : "defect";
      }

      let aP = 0, bP = 0;
      if (aAction === "cooperate" && bAction === "cooperate") { aP = 3; bP = 3; }
      else if (aAction === "defect" && bAction === "defect") { aP = 1; bP = 1; }
      else if (aAction === "defect") { aP = 5; bP = 0; }
      else { aP = 0; bP = 5; }

      const dramatic = (aAction === "defect" && bAction === "cooperate") || (bAction === "defect" && aAction === "cooperate");
      const content = `${a.avatar_emoji} ${a.name} [${aAction.toUpperCase()}] vs ${b.avatar_emoji} ${b.name} [${bAction.toUpperCase()}] → +${aP}/+${bP}`;
      return { a, b, aAction, bAction, aP, bP, dramatic, content };
    });

    for (const r of pairResults) {
      payoffs.set(r.a.id, (payoffs.get(r.a.id) ?? 0) + r.aP);
      payoffs.set(r.b.id, (payoffs.get(r.b.id) ?? 0) + r.bP);
      history.get(r.a.id)?.push(`R${round} vs ${r.b.name}: I ${r.aAction}, they ${r.bAction} → +${r.aP}`);
      history.get(r.b.id)?.push(`R${round} vs ${r.a.name}: I ${r.bAction}, they ${r.aAction} → +${r.bP}`);
      events.push({ id: generateId(), timestamp: new Date().toISOString(), type: r.dramatic ? "outcome" : "decision", content: r.content, is_dramatic: r.dramatic });
    }

    if (paired.length % 2 === 1) payoffs.set(paired[paired.length - 1].id, (payoffs.get(paired[paired.length - 1].id) ?? 0) + 2);
  }

  const ranked = bots.map((bot) => ({ bot, total: payoffs.get(bot.id) ?? 0 })).sort((a, b) => b.total - a.total);
  const cooperativePayoff = ROUNDS * 3;
  const nashPayoff = ROUNDS * 1;

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "reveal", content: `📊 RESULTS:\n${ranked.slice(0, 5).map((r, i) => `${i + 1}. ${r.bot.avatar_emoji} ${r.bot.name}: ${r.total} pts`).join("\n")}`, is_dramatic: true });

  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.3));
  const eliminatedIds = ranked.slice(-eliminateCount).map((e) => e.bot.id);
  for (const e of ranked.slice(-eliminateCount)) {
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated — ${e.total} pts`, is_dramatic: true });
  }

  return {
    participants: ranked.map((r) => ({ bot_id: r.bot.id, bot: r.bot, survived: !eliminatedIds.includes(r.bot.id), score: r.total, profit: r.total - nashPayoff, decision: `${r.total}/${ROUNDS * 5} pts`, optimal_delta: cooperativePayoff - r.total })),
    events, eliminatedIds,
    challenge: { scenario: `${ROUNDS}-round Prisoner's Dilemma`, variables: { rounds: ROUNDS, cc_payoff: 3, dd_payoff: 1, cd_payoff: 5 }, optimal_answer: `Cooperative: ${cooperativePayoff}`, optimal_value: cooperativePayoff, explanation: "Tit-for-tat consistently outperforms pure defection." },
  };
}

// ─── RISK ASSESSMENT ───────────────────────────────────────

export async function simulateRiskAssessment(bots: Bot[]): Promise<SimResult> {
  const events: GameEvent[] = [];
  const useLLM = isLLMEnabled();
  const scenarios = shuffle([...shuffle(RISK_SCENARIOS).slice(0, 2), generateDynamicRiskScenario()]).slice(0, 3);

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `⚠️ RISK ASSESSMENT: ${scenarios.length} scenarios. Calibration is everything.`, is_dramatic: true });

  const botList = shuffle(bots);
  const conc = useLLM ? getLlmConcurrency() : 12;

  const chunks = await mapPoolConcurrent(botList, conc, async (bot) => {
    let estimates: number[];
    let trace: AgentDecisionTrace | undefined;

    if (useLLM) {
      const result = await getRiskAssessmentDecision(bot, scenarios.map((s) => ({ scenario: s.scenario, question: s.question })));
      trace = result.trace;
      if (Array.isArray(result.decision)) {
        estimates = (result.decision as number[]).map((v) => clamp(Math.round(Number(v) || 50), 1, 99));
      } else {
        const nums = String(result.decision).match(/\d+/g);
        estimates = nums ? nums.slice(0, scenarios.length).map((n) => clamp(parseInt(n), 1, 99)) : scenarios.map(() => 50);
      }
      while (estimates.length < scenarios.length) estimates.push(50);
      estimates = estimates.slice(0, scenarios.length);
    } else {
      estimates = scenarios.map((s) => {
        const skill = 0.3 + bot.win_rate * 0.5;
        return clamp(Math.round(s.actual_probability + (Math.random() - 0.5) * 60 * (1 - skill) + (Math.random() - 0.5) * 20), 1, 99);
      });
    }

    const totalError = estimates.reduce((sum, est, i) => sum + Math.abs(est - scenarios[i].actual_probability), 0);
    const row = { bot, totalError, estimates, score: Math.max(0, 100 - (totalError / scenarios.length) * 2), trace };
    const ev: GameEvent = { id: generateId(), timestamp: new Date().toISOString(), type: "decision", actor_id: bot.id, actor_name: bot.name, content: `${bot.avatar_emoji} ${bot.name}: ${estimates.map((e, i) => `S${i + 1}: ${e}%`).join(" | ")}` };
    return { row, ev };
  });

  const scored = chunks.map((c) => c.row);
  for (const c of chunks) events.push(c.ev);

  for (let i = 0; i < scenarios.length; i++) {
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "reveal", content: `📊 S${i + 1}: "${scenarios[i].question}" → ${scenarios[i].actual_probability}%`, is_dramatic: true });
  }

  scored.sort((a, b) => a.totalError - b.totalError);
  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.2));
  const eliminatedIds = scored.slice(-eliminateCount).map((e) => e.bot.id);
  for (const e of scored.slice(-eliminateCount)) {
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated — avg error: ${(e.totalError / scenarios.length).toFixed(1)}%`, is_dramatic: true });
  }

  return {
    participants: scored.map((s) => ({ bot_id: s.bot.id, bot: s.bot, survived: !eliminatedIds.includes(s.bot.id), score: Math.round(s.score * 10) / 10, decision: s.estimates.map((e) => `${e}%`).join("/"), optimal_delta: Math.round(s.totalError / scenarios.length * 10) / 10, profit: Math.round((s.score - 50) * 10) / 10, decision_trace: s.trace })),
    events, eliminatedIds,
    challenge: { scenario: scenarios.map((s) => s.question).join(" | "), variables: Object.fromEntries(scenarios.map((s, i) => [`s${i + 1}_actual`, s.actual_probability])), optimal_answer: scenarios.map((s) => `${s.actual_probability}%`).join("/"), explanation: scenarios.map((s) => s.explanation).join(" | ") },
  };
}

// ─── AUCTION WARS ──────────────────────────────────────────

export async function simulateAuctionWars(bots: Bot[]): Promise<SimResult> {
  const item = pickRandom(AUCTION_ITEMS);
  const events: GameEvent[] = [];
  const useLLM = isLLMEnabled();
  const optimalBid = Math.round(item.value * (bots.length - 1) / bots.length);

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `🏛️ AUCTION WARS: ${item.description}\nHighest bid wins. Profit = Value - Bid.`, is_dramatic: true });

  const botList = shuffle(bots);
  const conc = useLLM ? getLlmConcurrency() : 12;

  const chunks = await mapPoolConcurrent(botList, conc, async (bot) => {
    let bid: number;
    let trace: AgentDecisionTrace | undefined;

    if (useLLM) {
      const result = await getAuctionDecision(bot, item.description, item.value, bots.length);
      bid = Math.max(1, Math.round(typeof result.decision === "number" ? result.decision : parseFloat(String(result.decision)) || optimalBid));
      trace = result.trace;
    } else {
      const skill = 0.3 + bot.win_rate * 0.5;
      bid = Math.max(1, Math.round(optimalBid + (Math.random() - 0.5) * item.value * 0.6 * (1 - skill)));
    }

    const row = { bot, bid, profit: 0, score: 0, trace };
    const ev: GameEvent = { id: generateId(), timestamp: new Date().toISOString(), type: "decision", actor_id: bot.id, actor_name: bot.name, content: `${bot.avatar_emoji} ${bot.name} bids: $${bid}` };
    return { row, ev };
  });

  const scored = chunks.map((c) => c.row);
  for (const c of chunks) events.push(c.ev);

  scored.sort((a, b) => b.bid - a.bid);
  scored[0].profit = item.value - scored[0].bid;
  for (let i = 1; i < scored.length; i++) scored[i].profit = scored[i].bid > item.value ? -(scored[i].bid - item.value) * 0.1 : 0;

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "reveal", content: `🏛️ Winner: ${scored[0].bot.avatar_emoji} ${scored[0].bot.name} ($${scored[0].bid})\n${scored[0].profit >= 0 ? `✅ Profit: $${scored[0].profit}` : `❌ Overpaid by $${Math.abs(scored[0].profit)}`}\nOptimal: $${optimalBid}`, is_dramatic: true });

  const finalScored = scored.map((s) => ({ ...s, score: Math.max(0, 100 - Math.abs(s.bid - optimalBid) / item.value * 200) })).sort((a, b) => b.score - a.score);
  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.3));
  const eliminatedIds = finalScored.slice(-eliminateCount).map((e) => e.bot.id);
  for (const e of finalScored.slice(-eliminateCount)) {
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated — bid $${e.bid} (optimal: $${optimalBid})`, is_dramatic: true });
  }

  return {
    participants: finalScored.map((s) => ({ bot_id: s.bot.id, bot: s.bot, survived: !eliminatedIds.includes(s.bot.id), score: Math.round(s.score * 10) / 10, decision: `Bid $${s.bid}`, optimal_delta: Math.abs(s.bid - optimalBid), profit: s.profit, decision_trace: s.trace })),
    events, eliminatedIds,
    challenge: { scenario: item.description, variables: { item_value: item.value, num_bidders: bots.length }, optimal_answer: `$${optimalBid}`, optimal_value: optimalBid, explanation: `Optimal = value × (N-1)/N = $${optimalBid}` },
  };
}

// ─── TEXAS HOLD'EM POKER (multi-table) ───────────────────

/** Typical live / online cap ~9 per table; split all entrants evenly across tables. */
const POKER_MAX_TABLE_SIZE = 9;
const POKER_MIN_TABLE_SIZE = 2;

function splitBotsIntoPokerTables(bots: Bot[]): Bot[][] {
  const shuffled = shuffle([...bots]);
  const n = shuffled.length;
  if (n === 0) return [];
  if (n <= POKER_MAX_TABLE_SIZE) return [shuffled];

  const numTables = Math.ceil(n / POKER_MAX_TABLE_SIZE);
  const baseSize = Math.floor(n / numTables);
  const remainder = n % numTables;
  const tables: Bot[][] = [];
  let idx = 0;
  for (let t = 0; t < numTables; t++) {
    const size = baseSize + (t < remainder ? 1 : 0);
    tables.push(shuffled.slice(idx, idx + size));
    idx += size;
  }

  const singles = tables.filter((tb) => tb.length === 1);
  const multi = tables.filter((tb) => tb.length >= POKER_MIN_TABLE_SIZE);
  for (const single of singles) {
    const lonely = single[0];
    if (!lonely) continue;
    const room = multi.filter((tb) => tb.length < POKER_MAX_TABLE_SIZE);
    const target =
      room.length > 0
        ? room.reduce((a, b) => (a.length <= b.length ? a : b))
        : multi.reduce((a, b) => (a.length <= b.length ? a : b));
    target.push(lonely);
  }
  return multi.filter((tb) => tb.length >= POKER_MIN_TABLE_SIZE);
}

async function simulatePokerSingleTable(
  tableBots: Bot[],
  tableNum: number,
  useLLM: boolean,
): Promise<{ tableEvents: GameEvent[]; chipCounts: Map<string, number> }> {
  const events: GameEvent[] = [];
  const STARTING_CHIPS = 1000;
  const SMALL_BLIND = 25;
  const BIG_BLIND = 50;
  const NUM_HANDS = 3;
  const tag = (hand: number) => `[T${tableNum}·H${hand}]`;

  const chipCounts = new Map<string, number>();
  tableBots.forEach((b) => chipCounts.set(b.id, STARTING_CHIPS));

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "twist",
    content: `🪑 Table ${tableNum} · ${tableBots.length} seats\n${tableBots.map((b) => `${b.avatar_emoji} ${b.name}`).join(" | ")}`,
    is_dramatic: true,
  });

  for (let hand = 1; hand <= NUM_HANDS; hand++) {
    const activePlayers = tableBots.filter((b) => (chipCounts.get(b.id) ?? 0) > 0);
    if (activePlayers.length < 2) break;

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "poker_deal",
      content: `🃏 Table ${tableNum} · Hand ${hand}/${NUM_HANDS} · ${activePlayers.length} in pot`,
      is_dramatic: true,
    });

    const deck = createShuffledShoeForHoldem(activePlayers.length);
    let deckIdx = 0;
    const holeCards: Map<string, Card[]> = new Map();

    for (const p of activePlayers) {
      const c1 = deck[deckIdx++];
      const c2 = deck[deckIdx++];
      const cards: Card[] = [c1, c2].filter((c): c is Card => c != null && typeof c.rank === "number");
      holeCards.set(p.id, cards);
      events.push({
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: "poker_deal",
        actor_id: p.id,
        actor_name: p.name,
        content: `${p.avatar_emoji} ${p.name} · [${cards.length === 2 ? handToString(cards) : "—"}]`,
      });
    }

    let pot = 0;
    const folded: Set<string> = new Set();
    const bets: Map<string, number> = new Map();
    activePlayers.forEach((p) => bets.set(p.id, 0));

    const sbPlayer = activePlayers[0];
    const bbPlayer = activePlayers[1 % activePlayers.length];
    const sbAmount = Math.min(SMALL_BLIND, chipCounts.get(sbPlayer.id) ?? 0);
    const bbAmount = Math.min(BIG_BLIND, chipCounts.get(bbPlayer.id) ?? 0);
    chipCounts.set(sbPlayer.id, (chipCounts.get(sbPlayer.id) ?? 0) - sbAmount);
    chipCounts.set(bbPlayer.id, (chipCounts.get(bbPlayer.id) ?? 0) - bbAmount);
    bets.set(sbPlayer.id, sbAmount);
    bets.set(bbPlayer.id, bbAmount);
    pot += sbAmount + bbAmount;

    const communityCards: Card[] = [];
    const BETTING_STAGES = ["Pre-Flop", "Flop", "Turn", "River"];

    for (let stage = 0; stage < 4; stage++) {
      if (stage === 1) {
        deckIdx++;
        communityCards.push(deck[deckIdx++], deck[deckIdx++], deck[deckIdx++]);
        events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "poker_deal", content: `🂠 T${tableNum} FLOP: ${handToString(communityCards)}`, is_dramatic: true });
      }
      if (stage === 2) {
        deckIdx++;
        communityCards.push(deck[deckIdx++]);
        events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "poker_deal", content: `🂠 T${tableNum} TURN: ${cardToString(communityCards[3])} → ${handToString(communityCards)}` });
      }
      if (stage === 3) {
        deckIdx++;
        communityCards.push(deck[deckIdx++]);
        events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "poker_deal", content: `🂠 T${tableNum} RIVER: ${cardToString(communityCards[4])} → ${handToString(communityCards)}`, is_dramatic: true });
      }

      const playersInHand = activePlayers.filter((p) => !folded.has(p.id) && (chipCounts.get(p.id) ?? 0) > 0);
      if (playersInHand.length <= 1) break;

      let currentBet = stage === 0 ? BIG_BLIND : 0;
      const roundBets: Map<string, number> = new Map();
      playersInHand.forEach((p) => roundBets.set(p.id, stage === 0 ? (bets.get(p.id) ?? 0) : 0));

      for (const player of playersInHand) {
        if (folded.has(player.id)) continue;
        const myChips = chipCounts.get(player.id) ?? 0;
        if (myChips <= 0) continue;

        const myBet = roundBets.get(player.id) ?? 0;
        const toCall = Math.min(currentBet - myBet, myChips);

        let action: string;

        if (useLLM) {
          const playerCards = holeCards.get(player.id) ?? [];
          const otherInfo = playersInHand.filter((p) => p.id !== player.id && !folded.has(p.id)).map((p) => `${p.name}: $${chipCounts.get(p.id)}`).join(", ");
          const handMarker = tag(hand);
          const bettingHist = events
            .filter((e) => e.type === "poker_action" && e.content.includes(handMarker))
            .map((e) => e.content.replace(handMarker, "").trim())
            .slice(-5)
            .join("\n");

          const result = await getPokerDecision(
            player,
            handToString(playerCards),
            communityCards.length > 0 ? handToString(communityCards) : "",
            pot,
            toCall,
            myChips,
            `Table ${tableNum}. ${otherInfo}`,
            bettingHist,
          );
          action = String(result.decision).toLowerCase();

          if (result.inner_thought) {
            events.push({
              id: generateId(),
              timestamp: new Date().toISOString(),
              type: "inner_thought",
              actor_id: player.id,
              actor_name: player.name,
              content: `💭 [T${tableNum}] ${result.inner_thought}`,
            });
          }
        } else {
          const handStr = getHandStrengthDescription(holeCards.get(player.id) ?? [], communityCards);
          const strength = handStr.includes("strong") || handStr.includes("Premium") ? 0.8 : handStr.includes("solid") || handStr.includes("decent") ? 0.5 : 0.3;
          const r = Math.random();
          if (toCall > 0 && r > strength + 0.1) action = "fold";
          else if (r > 0.7 && myChips > currentBet * 2) action = `raise_${Math.round(currentBet * (1 + Math.random()))}`;
          else if (toCall === 0) action = "check";
          else action = "call";
        }

        const actPrefix = `${tag(hand)} ${BETTING_STAGES[stage]} —`;

        if (action.includes("fold")) {
          folded.add(player.id);
          events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "poker_action", actor_id: player.id, actor_name: player.name, content: `${actPrefix} ${player.avatar_emoji} ${player.name} FOLDS` });
        } else if (action.includes("all_in")) {
          const allInAmount = myChips;
          chipCounts.set(player.id, 0);
          pot += allInAmount;
          roundBets.set(player.id, (roundBets.get(player.id) ?? 0) + allInAmount);
          currentBet = Math.max(currentBet, (roundBets.get(player.id) ?? 0));
          events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "poker_action", actor_id: player.id, actor_name: player.name, content: `${actPrefix} ${player.avatar_emoji} ${player.name} ALL IN! $${allInAmount}`, is_dramatic: true });
        } else if (action.includes("raise")) {
          const raiseMatch = action.match(/raise[_ ]?(\d+)/);
          const raiseAmount = Math.min(raiseMatch ? parseInt(raiseMatch[1]) : currentBet * 2, myChips);
          const totalBet = toCall + raiseAmount;
          chipCounts.set(player.id, myChips - totalBet);
          pot += totalBet;
          roundBets.set(player.id, (roundBets.get(player.id) ?? 0) + totalBet);
          currentBet = roundBets.get(player.id) ?? 0;
          events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "poker_action", actor_id: player.id, actor_name: player.name, content: `${actPrefix} ${player.avatar_emoji} ${player.name} RAISES to $${currentBet}`, is_dramatic: true });
        } else if (action.includes("call") && toCall > 0) {
          chipCounts.set(player.id, myChips - toCall);
          pot += toCall;
          roundBets.set(player.id, (roundBets.get(player.id) ?? 0) + toCall);
          events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "poker_action", actor_id: player.id, actor_name: player.name, content: `${actPrefix} ${player.avatar_emoji} ${player.name} calls $${toCall}` });
        } else {
          events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "poker_action", actor_id: player.id, actor_name: player.name, content: `${actPrefix} ${player.avatar_emoji} ${player.name} checks` });
        }

        if (activePlayers.filter((p) => !folded.has(p.id)).length <= 1) break;
      }

      if (activePlayers.filter((p) => !folded.has(p.id)).length <= 1) break;
    }

    const remaining = activePlayers.filter((p) => !folded.has(p.id));
    if (remaining.length === 1) {
      chipCounts.set(remaining[0].id, (chipCounts.get(remaining[0].id) ?? 0) + pot);
      events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "outcome", actor_id: remaining[0].id, actor_name: remaining[0].name, content: `[T${tableNum}] ${remaining[0].avatar_emoji} ${remaining[0].name} wins $${pot} (fold win)`, is_dramatic: true });
    } else if (remaining.length > 1) {
      const handResults = remaining
        .map((p) => {
          const cards = holeCards.get(p.id) ?? [];
          const result = evaluateHand(cards, communityCards);
          return { player: p, cards, result };
        })
        .sort((a, b) => compareHands(b.result, a.result));

      events.push({
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: "reveal",
        content: `🂠 Table ${tableNum} SHOWDOWN\n${handResults.map((h) => `${h.player.avatar_emoji} ${h.player.name}: ${handToString(h.cards)} → ${h.result.description}`).join("\n")}`,
        is_dramatic: true,
      });

      chipCounts.set(handResults[0].player.id, (chipCounts.get(handResults[0].player.id) ?? 0) + pot);
      events.push({
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: "outcome",
        actor_id: handResults[0].player.id,
        actor_name: handResults[0].player.name,
        content: `👑 [T${tableNum}] ${handResults[0].player.avatar_emoji} ${handResults[0].player.name} wins $${pot} — ${handResults[0].result.description}`,
        is_dramatic: true,
      });
    }
  }

  const tableRanking = tableBots
    .map((b) => ({ bot: b, chips: chipCounts.get(b.id) ?? 0, profit: (chipCounts.get(b.id) ?? 0) - STARTING_CHIPS }))
    .sort((a, b) => b.chips - a.chips);

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "comparison",
    content: `🃏 Table ${tableNum} final chips:\n${tableRanking.map((r, i) => `${i + 1}. ${r.bot.avatar_emoji} ${r.bot.name}: $${r.chips} (${r.profit > 0 ? "+" : ""}${r.profit})`).join("\n")}`,
    is_dramatic: true,
  });

  return { tableEvents: events, chipCounts };
}

export async function simulatePoker(bots: Bot[]): Promise<SimResult> {
  const events: GameEvent[] = [];
  const useLLM = isLLMEnabled();
  const STARTING_CHIPS = 1000;
  const SMALL_BLIND = 25;
  const BIG_BLIND = 50;
  const NUM_HANDS = 3;

  const tables = splitBotsIntoPokerTables(bots);
  const layout = tables.map((t) => t.length).join(" / ");
  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "twist",
    content: `🃏 TEXAS HOLD'EM · ${tables.length} tables (max ${POKER_MAX_TABLE_SIZE} per table) · seat counts: ${layout}\nStarting stack $${STARTING_CHIPS} · Blinds $${SMALL_BLIND}/$${BIG_BLIND} · ${NUM_HANDS} hands per table\nBots randomly seated; chip stacks compared across all tables after play.`,
    is_dramatic: true,
  });

  const globalChips = new Map<string, number>();
  for (const b of bots) globalChips.set(b.id, STARTING_CHIPS);

  for (let ti = 0; ti < tables.length; ti++) {
    const { tableEvents, chipCounts } = await simulatePokerSingleTable(tables[ti], ti + 1, useLLM);
    events.push(...tableEvents);
    for (const b of tables[ti]) globalChips.set(b.id, chipCounts.get(b.id) ?? STARTING_CHIPS);
  }

  const finalRanking = bots
    .map((b) => {
      const chips = globalChips.get(b.id) ?? STARTING_CHIPS;
      return { bot: b, chips, profit: chips - STARTING_CHIPS };
    })
    .sort((a, b) => b.chips - a.chips);

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "comparison",
    content: `🏁 ALL TABLES — chip leaders:\n${finalRanking.slice(0, 8).map((r, i) => `${i + 1}. ${r.bot.avatar_emoji} ${r.bot.name}: $${r.chips} (${r.profit > 0 ? "+" : ""}${r.profit})`).join("\n")}`,
    is_dramatic: true,
  });

  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.25));
  const eliminatedIds = finalRanking.slice(-eliminateCount).map((r) => r.bot.id);
  for (const e of finalRanking.slice(-eliminateCount)) {
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "elimination",
      actor_id: e.bot.id,
      actor_name: e.bot.name,
      content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated — $${e.chips} chips (${e.profit > 0 ? "+" : ""}${e.profit})`,
      is_dramatic: true,
    });
  }

  return {
    participants: finalRanking.map((r) => ({
      bot_id: r.bot.id,
      bot: r.bot,
      survived: !eliminatedIds.includes(r.bot.id),
      score: Math.max(0, 50 + r.profit / 20),
      decision: `$${r.chips} chips`,
      profit: r.profit,
    })),
    events,
    eliminatedIds,
    challenge: {
      scenario: `Texas Hold'em multi-table: ${tables.length} tables, ≤${POKER_MAX_TABLE_SIZE} per table, ${NUM_HANDS} hands each, $${STARTING_CHIPS} stacks`,
      variables: {
        tables: tables.length,
        max_table: POKER_MAX_TABLE_SIZE,
        seat_layout: tables.map((t) => t.length).join(","),
        starting_chips: STARTING_CHIPS,
        num_hands: NUM_HANDS,
        small_blind: SMALL_BLIND,
        big_blind: BIG_BLIND,
      },
      optimal_answer: "Survive and accumulate",
      explanation: "Same starting stack at each table; final ranking merges all tables by ending chips.",
    },
  };
}

// ─── STOCK PREDICTION ──────────────────────────────────────

export async function simulateStockPrediction(bots: Bot[]): Promise<SimResult> {
  const scenario = pickRandom(STOCK_SCENARIOS);
  const events: GameEvent[] = [];
  const useLLM = isLLMEnabled();

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `📊 STOCK PREDICTION: ${scenario.stock}\n${scenario.opening_data}\n${scenario.market_context}\n\nEach bot will use their analysis tools to research, then predict today's closing move.`, is_dramatic: true });

  const botList = shuffle(bots);
  const conc = useLLM ? getLlmConcurrency() : 12;

  const chunks = await mapPoolConcurrent(botList, conc, async (bot) => {
    const local: GameEvent[] = [];
    let prediction: number;
    let reasoning: string | undefined;
    let innerThought: string;
    let trace: AgentDecisionTrace | undefined;

    if (useLLM) {
      const result = await getStockPredictionDecision(bot, `Stock: ${scenario.stock}\n${scenario.opening_data}`, scenario.market_context);
      prediction = typeof result.decision === "number" ? result.decision : parseFloat(String(result.decision)) || 0;
      prediction = Math.round(prediction * 10) / 10;
      reasoning = result.reasoning;
      innerThought = result.inner_thought;
      trace = result.trace;

      for (const step of result.trace.steps) {
        if (step.type === "tool_call") {
          local.push({ id: generateId(), timestamp: step.timestamp, type: "tool_call", actor_id: bot.id, actor_name: bot.name, content: `🔧 ${bot.avatar_emoji} ${bot.name} → ${step.tool_name}(${JSON.stringify(step.tool_input)})` });
        } else if (step.type === "tool_result") {
          local.push({ id: generateId(), timestamp: step.timestamp, type: "tool_result", actor_id: bot.id, actor_name: bot.name, content: `📋 ${bot.name}: ${(step.tool_output ?? "").slice(0, 120)}...` });
        }
      }
    } else {
      const skill = 0.3 + bot.win_rate * 0.5;
      prediction = Math.round((scenario.actual_move + (Math.random() - 0.5) * 15 * (1 - skill)) * 10) / 10;
      innerThought = pickRandom(ANALYSIS_THOUGHTS);
    }

    const error = Math.abs(prediction - scenario.actual_move);
    const row = { bot, prediction, error, score: Math.max(0, 100 - error * 8), trace };

    local.push({ id: generateId(), timestamp: new Date().toISOString(), type: "analysis", actor_id: bot.id, actor_name: bot.name, content: `${bot.avatar_emoji} ${bot.name} predicts ${scenario.stock}: ${prediction > 0 ? "+" : ""}${prediction}%${reasoning ? ` — "${reasoning.slice(0, 100)}"` : ""}` });
    local.push({ id: generateId(), timestamp: new Date().toISOString(), type: "inner_thought", actor_id: bot.id, actor_name: bot.name, content: `💭 ${innerThought}` });

    return { row, local };
  });

  const scored = chunks.map((c) => c.row);
  for (const c of chunks) events.push(...c.local);

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "reveal", content: `📊 ACTUAL CLOSING MOVE: ${scenario.stock} ${scenario.actual_move > 0 ? "+" : ""}${scenario.actual_move}%\n${scenario.explanation}`, is_dramatic: true });

  scored.sort((a, b) => a.error - b.error);
  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "comparison", content: `🏆 Best: ${scored[0].bot.avatar_emoji} ${scored[0].bot.name} (error: ${scored[0].error.toFixed(1)}%)\n📉 Worst: ${scored[scored.length - 1].bot.avatar_emoji} ${scored[scored.length - 1].bot.name} (error: ${scored[scored.length - 1].error.toFixed(1)}%)`, is_dramatic: true });

  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.2));
  const eliminatedIds = scored.slice(-eliminateCount).map((e) => e.bot.id);
  for (const e of scored.slice(-eliminateCount)) {
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated — predicted ${e.prediction > 0 ? "+" : ""}${e.prediction}%, actual ${scenario.actual_move > 0 ? "+" : ""}${scenario.actual_move}%`, is_dramatic: true });
  }

  return {
    participants: scored.map((s) => ({ bot_id: s.bot.id, bot: s.bot, survived: !eliminatedIds.includes(s.bot.id), score: Math.round(s.score * 10) / 10, decision: `${s.prediction > 0 ? "+" : ""}${s.prediction}%`, optimal_delta: Math.round(s.error * 10) / 10, profit: Math.round((s.score - 50) * 10) / 10, decision_trace: s.trace })),
    events, eliminatedIds,
    challenge: { scenario: `${scenario.stock}: ${scenario.opening_data}`, variables: { stock: scenario.stock }, optimal_answer: `${scenario.actual_move > 0 ? "+" : ""}${scenario.actual_move}%`, optimal_value: scenario.actual_move, explanation: scenario.explanation },
  };
}

// ─── FINAL OPTIMIZATION ────────────────────────────────────

export async function simulateFinalOptimization(bots: Bot[]): Promise<SimResult> {
  const problem = pickRandom(OPTIMIZATION_PROBLEMS);
  const events: GameEvent[] = [];
  const useLLM = isLLMEnabled();

  if (bots.length <= 1) {
    return {
      participants: bots.map((b) => ({ bot_id: b.id, bot: b, survived: true, score: 100 })),
      events: [{ id: generateId(), timestamp: new Date().toISOString(), type: "reveal", content: bots.length === 1 ? `👑 ${bots[0].avatar_emoji} ${bots[0].name} — CHAMPION!` : "No bots.", is_dramatic: true }],
      eliminatedIds: [],
      challenge: { scenario: problem.scenario, variables: problem.variables, optimal_value: problem.optimal, explanation: problem.explanation },
    };
  }

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `⚔️ FINAL OPTIMIZATION: ${problem.scenario}`, is_dramatic: true, data: problem.variables });

  const conc = useLLM ? getLlmConcurrency() : 12;

  const chunks = await mapPoolConcurrent(bots, conc, async (bot) => {
    let answer: number;
    let innerThought: string;
    let trace: AgentDecisionTrace | undefined;

    if (useLLM) {
      const result = await getFinalOptimizationDecision(bot, problem.scenario, problem.variables);
      answer = Math.round((typeof result.decision === "number" ? result.decision : parseFloat(String(result.decision)) || 0) * 10) / 10;
      innerThought = result.inner_thought;
      trace = result.trace;
    } else {
      const skill = 0.3 + bot.win_rate * 0.5;
      answer = Math.round((problem.optimal + (Math.random() - 0.5) * problem.optimal * 0.8 * (1 - skill)) * 10) / 10;
      innerThought = pickRandom(ANALYSIS_THOUGHTS);
    }

    const error = Math.abs(answer - problem.optimal);
    const row = { bot, answer, error, score: Math.max(0, 100 - (error / problem.optimal) * 100), trace };
    const ev: GameEvent[] = [
      { id: generateId(), timestamp: new Date().toISOString(), type: "decision", actor_id: bot.id, actor_name: bot.name, content: `${bot.avatar_emoji} ${bot.name}: ${answer}` },
      { id: generateId(), timestamp: new Date().toISOString(), type: "inner_thought", actor_id: bot.id, actor_name: bot.name, content: `💭 ${innerThought}` },
    ];
    return { row, ev };
  });

  const scored = chunks.map((c) => c.row);
  for (const c of chunks) events.push(...c.ev);

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "reveal", content: `📊 OPTIMAL: ${problem.optimal}\n${problem.explanation}`, is_dramatic: true });

  scored.sort((a, b) => a.error - b.error);
  const eliminatedIds = scored.slice(1).map((s) => s.bot.id);

  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "reveal", content: `👑 CHAMPION: ${scored[0].bot.avatar_emoji} ${scored[0].bot.name}!\nAnswer: ${scored[0].answer} (optimal: ${problem.optimal}, error: ${scored[0].error.toFixed(1)})`, is_dramatic: true });

  for (let i = 1; i < scored.length; i++) {
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: scored[i].bot.id, actor_name: scored[i].bot.name, content: `💀 ${scored[i].bot.avatar_emoji} ${scored[i].bot.name} — answer: ${scored[i].answer}`, is_dramatic: true });
  }

  return {
    participants: scored.map((s) => ({ bot_id: s.bot.id, bot: s.bot, survived: s.bot.id === scored[0].bot.id, score: Math.round(s.score * 10) / 10, decision: `${s.answer}`, optimal_delta: Math.round(s.error * 10) / 10, decision_trace: s.trace })),
    events, eliminatedIds,
    challenge: { scenario: problem.scenario, variables: problem.variables, optimal_answer: `${problem.optimal}`, optimal_value: problem.optimal, explanation: problem.explanation },
  };
}

// ─── MAIN DISPATCH ─────────────────────────────────────────

export async function simulateRound(gameType: GameType, bots: Bot[]): Promise<SimResult> {
  switch (gameType) {
    case "market_forecast": return simulateMarketForecast(bots);
    case "resource_allocation": return simulateResourceAllocation(bots);
    case "prisoners_dilemma": return simulatePrisonersDilemma(bots);
    case "risk_assessment": return simulateRiskAssessment(bots);
    case "auction_wars": return simulateAuctionWars(bots);
    case "poker": return simulatePoker(bots);
    case "stock_prediction": return simulateStockPrediction(bots);
    case "final_optimization": return simulateFinalOptimization(bots);
  }
}

// ─── SYNC VERSIONS (random-only, for startup data) ─────────

function syncMarketForecast(bots: Bot[]): SimResult {
  const scenario = Math.random() > 0.5 ? pickRandom(MARKET_SCENARIOS) : generateDynamicMarketScenario();
  const events: GameEvent[] = [{ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `📈 MARKET FORECAST: ${scenario.scenario}`, is_dramatic: true }];
  const scored = shuffle(bots).map((bot) => {
    const skill = 0.3 + bot.win_rate * 0.5;
    const prediction = Math.round((scenario.optimal + (Math.random() - 0.5) * 30 * (1 - skill)) * 10) / 10;
    const error = Math.abs(prediction - scenario.optimal);
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "analysis", actor_id: bot.id, actor_name: bot.name, content: `${bot.avatar_emoji} ${bot.name}: ${prediction > 0 ? "+" : ""}${prediction}%` });
    return { bot, prediction, error, score: Math.max(0, 100 - error * 5) };
  });
  scored.sort((a, b) => a.error - b.error);
  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.25));
  const eliminatedIds = scored.slice(-eliminateCount).map((e) => e.bot.id);
  for (const e of scored.slice(-eliminateCount)) events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated`, is_dramatic: true });
  return { participants: scored.map((s) => ({ bot_id: s.bot.id, bot: s.bot, survived: !eliminatedIds.includes(s.bot.id), score: Math.round(s.score * 10) / 10, decision: `${s.prediction > 0 ? "+" : ""}${s.prediction}%`, optimal_delta: Math.round(s.error * 10) / 10, profit: Math.round((s.score - 50) * 10) / 10 })), events, eliminatedIds, challenge: { scenario: scenario.scenario, variables: scenario.signals as Record<string, string | number>, optimal_answer: `${scenario.optimal > 0 ? "+" : ""}${scenario.optimal}%`, optimal_value: scenario.optimal, explanation: scenario.explanation } };
}

function syncResourceAllocation(bots: Bot[]): SimResult {
  const scenario = Math.random() > 0.5 ? pickRandom(ALLOCATION_SCENARIOS) : generateDynamicAllocationScenario();
  const events: GameEvent[] = [{ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `💰 RESOURCE ALLOCATION: ${scenario.scenario}`, is_dramatic: true }];
  const scored = shuffle(bots).map((bot) => {
    const raw = scenario.optimal.map((opt) => Math.max(0, opt + (Math.random() - 0.5) * 300 * (1 - bot.win_rate * 0.5)));
    const total = raw.reduce((a, b) => a + b, 0);
    const allocation = raw.map((v) => Math.round((v / total) * 1000));
    allocation[0] += 1000 - allocation.reduce((a, b) => a + b, 0);
    const error = allocation.reduce((sum, val, i) => sum + Math.abs(val - scenario.optimal[i]), 0);
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "decision", actor_id: bot.id, actor_name: bot.name, content: `${bot.avatar_emoji} ${bot.name}: ${allocation.join("/")}` });
    return { bot, allocation, error, score: Math.max(0, 100 - error / 10) };
  });
  scored.sort((a, b) => a.error - b.error);
  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.25));
  const eliminatedIds = scored.slice(-eliminateCount).map((e) => e.bot.id);
  for (const e of scored.slice(-eliminateCount)) events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated`, is_dramatic: true });
  return { participants: scored.map((s) => ({ bot_id: s.bot.id, bot: s.bot, survived: !eliminatedIds.includes(s.bot.id), score: Math.round(s.score * 10) / 10, decision: s.allocation.join("/"), optimal_delta: s.error, profit: Math.round((s.score - 50) * 10) / 10 })), events, eliminatedIds, challenge: { scenario: scenario.scenario, variables: Object.fromEntries(scenario.options.map((o, i) => [o, scenario.optimal[i]])), optimal_answer: scenario.optimal.join("/"), explanation: scenario.explanation } };
}

function syncPrisonersDilemma(bots: Bot[]): SimResult {
  const events: GameEvent[] = [];
  const payoffs: Map<string, number> = new Map();
  bots.forEach((b) => payoffs.set(b.id, 0));
  const ROUNDS = 5;
  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `🤝 PRISONER'S DILEMMA: ${ROUNDS} rounds.`, is_dramatic: true });
  for (let round = 1; round <= ROUNDS; round++) {
    const paired = shuffle([...bots]);
    for (let i = 0; i < paired.length - 1; i += 2) {
      const a = paired[i], b = paired[i + 1];
      const aA: "cooperate" | "defect" = Math.random() < 0.4 + a.win_rate * 0.3 ? "cooperate" : "defect";
      const bA: "cooperate" | "defect" = Math.random() < 0.4 + b.win_rate * 0.3 ? "cooperate" : "defect";
      let aP = 0, bP = 0;
      if (aA === "cooperate" && bA === "cooperate") { aP = 3; bP = 3; } else if (aA === "defect" && bA === "defect") { aP = 1; bP = 1; } else if (aA === "defect") { aP = 5; bP = 0; } else { aP = 0; bP = 5; }
      payoffs.set(a.id, (payoffs.get(a.id) ?? 0) + aP);
      payoffs.set(b.id, (payoffs.get(b.id) ?? 0) + bP);
      events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "decision", content: `${a.avatar_emoji} ${a.name} [${aA.toUpperCase()}] vs ${b.avatar_emoji} ${b.name} [${bA.toUpperCase()}]` });
    }
    if (paired.length % 2 === 1) payoffs.set(paired[paired.length - 1].id, (payoffs.get(paired[paired.length - 1].id) ?? 0) + 2);
  }
  const ranked = bots.map((bot) => ({ bot, total: payoffs.get(bot.id) ?? 0 })).sort((a, b) => b.total - a.total);
  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.3));
  const eliminatedIds = ranked.slice(-eliminateCount).map((e) => e.bot.id);
  for (const e of ranked.slice(-eliminateCount)) events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated`, is_dramatic: true });
  return { participants: ranked.map((r) => ({ bot_id: r.bot.id, bot: r.bot, survived: !eliminatedIds.includes(r.bot.id), score: r.total, profit: r.total - ROUNDS, decision: `${r.total}/${ROUNDS * 5} pts`, optimal_delta: ROUNDS * 3 - r.total })), events, eliminatedIds, challenge: { scenario: `${ROUNDS}-round Prisoner's Dilemma`, variables: { rounds: ROUNDS }, optimal_answer: `${ROUNDS * 3}`, optimal_value: ROUNDS * 3, explanation: "Tit-for-tat outperforms pure defection." } };
}

function syncRiskAssessment(bots: Bot[]): SimResult {
  const events: GameEvent[] = [];
  const scenarios = shuffle([...shuffle(RISK_SCENARIOS).slice(0, 2), generateDynamicRiskScenario()]).slice(0, 3);
  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `⚠️ RISK ASSESSMENT: ${scenarios.length} scenarios.`, is_dramatic: true });
  const scored = shuffle(bots).map((bot) => {
    const estimates = scenarios.map((s) => clamp(Math.round(s.actual_probability + (Math.random() - 0.5) * 60 * (1 - bot.win_rate * 0.5)), 1, 99));
    const totalError = estimates.reduce((sum, est, i) => sum + Math.abs(est - scenarios[i].actual_probability), 0);
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "decision", actor_id: bot.id, actor_name: bot.name, content: `${bot.avatar_emoji} ${bot.name}: ${estimates.map((e, i) => `S${i + 1}:${e}%`).join(" ")}` });
    return { bot, totalError, estimates, score: Math.max(0, 100 - (totalError / scenarios.length) * 2) };
  });
  scored.sort((a, b) => a.totalError - b.totalError);
  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.2));
  const eliminatedIds = scored.slice(-eliminateCount).map((e) => e.bot.id);
  for (const e of scored.slice(-eliminateCount)) events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated`, is_dramatic: true });
  return { participants: scored.map((s) => ({ bot_id: s.bot.id, bot: s.bot, survived: !eliminatedIds.includes(s.bot.id), score: Math.round(s.score * 10) / 10, decision: s.estimates.map((e) => `${e}%`).join("/"), optimal_delta: Math.round(s.totalError / scenarios.length * 10) / 10, profit: Math.round((s.score - 50) * 10) / 10 })), events, eliminatedIds, challenge: { scenario: scenarios.map((s) => s.question).join(" | "), variables: Object.fromEntries(scenarios.map((s, i) => [`s${i + 1}`, s.actual_probability])), optimal_answer: scenarios.map((s) => `${s.actual_probability}%`).join("/"), explanation: scenarios.map((s) => s.explanation).join(" | ") } };
}

function syncAuctionWars(bots: Bot[]): SimResult {
  const item = pickRandom(AUCTION_ITEMS);
  const events: GameEvent[] = [{ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `🏛️ AUCTION: ${item.description}`, is_dramatic: true }];
  const optimalBid = Math.round(item.value * (bots.length - 1) / bots.length);
  const scored = shuffle(bots).map((bot) => {
    const bid = Math.max(1, Math.round(optimalBid + (Math.random() - 0.5) * item.value * 0.6 * (1 - bot.win_rate * 0.5)));
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "decision", actor_id: bot.id, actor_name: bot.name, content: `${bot.avatar_emoji} ${bot.name}: $${bid}` });
    return { bot, bid, profit: 0, score: Math.max(0, 100 - Math.abs(bid - optimalBid) / item.value * 200) };
  });
  scored.sort((a, b) => b.bid - a.bid);
  scored[0].profit = item.value - scored[0].bid;
  scored.sort((a, b) => b.score - a.score);
  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.3));
  const eliminatedIds = scored.slice(-eliminateCount).map((e) => e.bot.id);
  for (const e of scored.slice(-eliminateCount)) events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated`, is_dramatic: true });
  return { participants: scored.map((s) => ({ bot_id: s.bot.id, bot: s.bot, survived: !eliminatedIds.includes(s.bot.id), score: Math.round(s.score * 10) / 10, decision: `$${s.bid}`, optimal_delta: Math.abs(s.bid - optimalBid), profit: s.profit })), events, eliminatedIds, challenge: { scenario: item.description, variables: { value: item.value }, optimal_answer: `$${optimalBid}`, optimal_value: optimalBid, explanation: `Optimal = $${optimalBid}` } };
}

function syncPoker(bots: Bot[]): SimResult {
  const tables = splitBotsIntoPokerTables(bots);
  const layout = tables.map((t) => t.length).join("/");
  const events: GameEvent[] = [
    {
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "twist",
      content: `🃏 POKER · ${tables.length} tables (${layout} players)`,
      is_dramatic: true,
    },
  ];
  const ranked = shuffle(bots).map((bot) => {
    const skill = 0.3 + bot.win_rate * 0.5;
    const chips = Math.round(1000 + (Math.random() - 0.4) * 800 * skill);
    return { bot, chips, profit: chips - 1000 };
  }).sort((a, b) => b.chips - a.chips);
  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.25));
  const eliminatedIds = ranked.slice(-eliminateCount).map((r) => r.bot.id);
  for (const e of ranked.slice(-eliminateCount)) events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated`, is_dramatic: true });
  return { participants: ranked.map((r) => ({ bot_id: r.bot.id, bot: r.bot, survived: !eliminatedIds.includes(r.bot.id), score: Math.max(0, 50 + r.profit / 20), decision: `$${r.chips}`, profit: r.profit })), events, eliminatedIds, challenge: { scenario: "Texas Hold'em", variables: { starting_chips: 1000 }, optimal_answer: "Survive", explanation: "Poker rewards information and risk management." } };
}

function syncStockPrediction(bots: Bot[]): SimResult {
  const scenario = pickRandom(STOCK_SCENARIOS);
  const events: GameEvent[] = [{ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `📊 STOCK PREDICTION: ${scenario.stock}`, is_dramatic: true }];
  const scored = shuffle(bots).map((bot) => {
    const skill = 0.3 + bot.win_rate * 0.5;
    const prediction = Math.round((scenario.actual_move + (Math.random() - 0.5) * 15 * (1 - skill)) * 10) / 10;
    const error = Math.abs(prediction - scenario.actual_move);
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "analysis", actor_id: bot.id, actor_name: bot.name, content: `${bot.avatar_emoji} ${bot.name}: ${prediction > 0 ? "+" : ""}${prediction}%` });
    return { bot, prediction, error, score: Math.max(0, 100 - error * 8) };
  });
  scored.sort((a, b) => a.error - b.error);
  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.2));
  const eliminatedIds = scored.slice(-eliminateCount).map((e) => e.bot.id);
  for (const e of scored.slice(-eliminateCount)) events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "elimination", actor_id: e.bot.id, actor_name: e.bot.name, content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated`, is_dramatic: true });
  return { participants: scored.map((s) => ({ bot_id: s.bot.id, bot: s.bot, survived: !eliminatedIds.includes(s.bot.id), score: Math.round(s.score * 10) / 10, decision: `${s.prediction > 0 ? "+" : ""}${s.prediction}%`, optimal_delta: Math.round(s.error * 10) / 10, profit: Math.round((s.score - 50) * 10) / 10 })), events, eliminatedIds, challenge: { scenario: scenario.stock, variables: { stock: scenario.stock }, optimal_answer: `${scenario.actual_move > 0 ? "+" : ""}${scenario.actual_move}%`, optimal_value: scenario.actual_move, explanation: scenario.explanation } };
}

function syncFinalOptimization(bots: Bot[]): SimResult {
  const problem = pickRandom(OPTIMIZATION_PROBLEMS);
  const events: GameEvent[] = [];
  if (bots.length <= 1) {
    return { participants: bots.map((b) => ({ bot_id: b.id, bot: b, survived: true, score: 100 })), events: [{ id: generateId(), timestamp: new Date().toISOString(), type: "reveal", content: bots.length === 1 ? `👑 ${bots[0].avatar_emoji} ${bots[0].name} — CHAMPION!` : "No bots.", is_dramatic: true }], eliminatedIds: [], challenge: { scenario: problem.scenario, variables: problem.variables, optimal_value: problem.optimal, explanation: problem.explanation } };
  }
  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "twist", content: `⚔️ FINAL: ${problem.scenario}`, is_dramatic: true });
  const scored = bots.map((bot) => {
    const skill = 0.3 + bot.win_rate * 0.5;
    const answer = Math.round((problem.optimal + (Math.random() - 0.5) * problem.optimal * 0.8 * (1 - skill)) * 10) / 10;
    const error = Math.abs(answer - problem.optimal);
    events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "decision", actor_id: bot.id, actor_name: bot.name, content: `${bot.avatar_emoji} ${bot.name}: ${answer}` });
    return { bot, answer, error, score: Math.max(0, 100 - (error / problem.optimal) * 100) };
  });
  scored.sort((a, b) => a.error - b.error);
  const eliminatedIds = scored.slice(1).map((s) => s.bot.id);
  events.push({ id: generateId(), timestamp: new Date().toISOString(), type: "reveal", content: `👑 CHAMPION: ${scored[0].bot.avatar_emoji} ${scored[0].bot.name}! (${scored[0].answer})`, is_dramatic: true });
  return { participants: scored.map((s) => ({ bot_id: s.bot.id, bot: s.bot, survived: s.bot.id === scored[0].bot.id, score: Math.round(s.score * 10) / 10, decision: `${s.answer}`, optimal_delta: Math.round(s.error * 10) / 10 })), events, eliminatedIds, challenge: { scenario: problem.scenario, variables: problem.variables, optimal_answer: `${problem.optimal}`, optimal_value: problem.optimal, explanation: problem.explanation } };
}

export function simulateRoundSync(gameType: GameType, bots: Bot[]): SimResult {
  switch (gameType) {
    case "market_forecast": return syncMarketForecast(bots);
    case "resource_allocation": return syncResourceAllocation(bots);
    case "prisoners_dilemma": return syncPrisonersDilemma(bots);
    case "risk_assessment": return syncRiskAssessment(bots);
    case "auction_wars": return syncAuctionWars(bots);
    case "poker": return syncPoker(bots);
    case "stock_prediction": return syncStockPrediction(bots);
    case "final_optimization": return syncFinalOptimization(bots);
  }
}

// ─── MONTHLY SPECIAL EVENT SCHEDULE ─────────────────────────

import type { SpecialEventSchedule } from "@/types";

const SPECIAL_GAME_TYPES: GameType[] = [
  "poker",
  "prisoners_dilemma",
  "market_forecast",
  "risk_assessment",
  "resource_allocation",
  "auction_wars",
];

export function generateMonthlySpecialSchedule(month: string): SpecialEventSchedule[] {
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();

  const tradingDays: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, mon - 1, d);
    const dow = date.getDay();
    if (dow >= 1 && dow <= 5) {
      tradingDays.push(`${month}-${String(d).padStart(2, "0")}`);
    }
  }

  const availableDays = tradingDays.slice(3);
  const shuffledDays = [...availableDays].sort(() => Math.random() - 0.5);
  const selectedDays = shuffledDays.slice(0, SPECIAL_GAME_TYPES.length).sort();

  return SPECIAL_GAME_TYPES.map((gameType, i) => ({
    game_type: gameType,
    scheduled_date: selectedDays[i] ?? tradingDays[tradingDays.length - 1 - i] ?? `${month}-15`,
    status: "upcoming" as const,
  }));
}
