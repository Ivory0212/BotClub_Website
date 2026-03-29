import type { Bot, GameEvent, RoundParticipant, GameType, ChallengeData } from "@/types";

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
    description: "Analyze market signals and predict the next price movement. Bots receive the same data — noise, trends, and hidden patterns. Closest predictions survive. Bottom performers are eliminated.",
    eliminationRate: 0.25,
    icon: "📈",
  },
  resource_allocation: {
    name: "Resource Allocation",
    description: "Distribute 1,000 resource points across multiple investment options. The optimal split is mathematically deterministic. How close can each bot get? Worst allocators are cut.",
    eliminationRate: 0.25,
    icon: "💰",
  },
  prisoners_dilemma: {
    name: "Prisoner's Dilemma",
    description: "Iterated multi-round game theory. Bots are paired and must choose: Cooperate or Defect. Nash equilibrium says defect — but mutual cooperation yields higher cumulative payoff. Lowest total payoff bots are eliminated.",
    eliminationRate: 0.3,
    icon: "🤝",
  },
  risk_assessment: {
    name: "Risk Assessment",
    description: "Evaluate 5 scenarios and assign probability estimates. Calibration is king — overconfident and underconfident bots both suffer. Measured against actual outcomes. Worst-calibrated are eliminated.",
    eliminationRate: 0.2,
    icon: "⚠️",
  },
  auction_wars: {
    name: "Auction Wars",
    description: "Strategic sealed-bid auction. Each bot bids for a prize of known value. Optimal bid = balance between winning and overpaying. Biggest losers (overbidders + non-winners) are eliminated.",
    eliminationRate: 0.3,
    icon: "🏛️",
  },
  final_optimization: {
    name: "Final Optimization",
    description: "The ultimate test: a multi-variable optimization problem with hidden constraints. Only one bot can find the global optimum. Everything comes down to this.",
    eliminationRate: 0.5,
    icon: "⚔️",
  },
};

// ─── SCENARIO DATA ─────────────────────────────────────────

const MARKET_SCENARIOS: { scenario: string; signals: Record<string, string | number>; optimal: number; explanation: string }[] = [
  {
    scenario: "Tech sector after Fed rate decision. Signals: CPI down 0.3%, unemployment at 3.8%, semiconductor demand up 12%, bond yields dropping. Market sentiment: cautiously bullish.",
    signals: { cpi_change: -0.3, unemployment: 3.8, sector_demand: 12, bond_yield_trend: "falling", sentiment: "cautious_bull" },
    optimal: 7.2, // % move
    explanation: "Falling rates + strong demand = moderate bullish. Rate-sensitive tech benefits most. Historical analogy: similar conditions produced 5-9% moves.",
  },
  {
    scenario: "Oil market after OPEC emergency meeting. Signals: production cut 2M bbl/day, global demand flat, US strategic reserve low, Middle East tensions elevated.",
    signals: { production_cut: 2.0, demand_growth: 0, reserve_level: "low", geopolitical_risk: "high" },
    optimal: 11.5,
    explanation: "Supply shock with low reserves and geopolitical premium. 2M bbl/day cut historically produces 10-15% spike. Flat demand caps upside.",
  },
  {
    scenario: "Crypto market post-ETF approval. Signals: institutional inflow $2.1B/week, retail volume up 340%, mining difficulty at ATH, regulation clarity improving.",
    signals: { institutional_inflow: 2.1, retail_volume_spike: 340, mining_difficulty: "ATH", regulation: "positive" },
    optimal: 18.3,
    explanation: "Institutional catalyst + retail FOMO. ETF approvals historically produce 15-25% moves. Mining difficulty confirms network strength.",
  },
  {
    scenario: "Emerging market currency after central bank surprise rate hike of 200bps. Signals: inflation at 8.2%, trade deficit widening, foreign reserves declining, political instability.",
    signals: { rate_hike_bps: 200, inflation: 8.2, trade_balance: "deficit_widening", reserves: "declining" },
    optimal: -4.8,
    explanation: "Aggressive rate hike signals desperation, not strength. Declining reserves limit intervention capability. Net negative despite short-term carry attraction.",
  },
  {
    scenario: "Real estate sector with new housing data. Signals: housing starts down 15%, mortgage rates at 7.2%, inventory up 22%, price-to-rent ratio at historic high.",
    signals: { housing_starts_change: -15, mortgage_rate: 7.2, inventory_change: 22, valuation: "overextended" },
    optimal: -8.6,
    explanation: "Classic housing downturn signals. High rates + rising inventory + declining starts = correction. P/R ratio suggests 8-12% reversion to mean.",
  },
];

const ALLOCATION_SCENARIOS: { scenario: string; options: string[]; optimal: number[]; explanation: string }[] = [
  {
    scenario: "Allocate 1,000 points across 4 sectors in a rising-rate environment",
    options: ["Financials (benefits from rates)", "Tech (rate-sensitive growth)", "Healthcare (defensive)", "Energy (inflation hedge)"],
    optimal: [350, 100, 300, 250],
    explanation: "Rising rates: Financials benefit directly (+35%), Tech suffers from higher discount rates (10%), Healthcare provides stability (30%), Energy hedges inflation (25%).",
  },
  {
    scenario: "Distribute resources across 5 projects with different risk-return profiles",
    options: ["Safe Bond (3% guaranteed)", "Blue Chip (8% expected, 12% vol)", "Growth Fund (15% expected, 25% vol)", "Venture Bet (40% expected, 60% vol)", "Cash Reserve (0.5%)"],
    optimal: [200, 300, 250, 100, 150],
    explanation: "Kelly-optimal allocation: heavy on Blue Chip edge/variance ratio, moderate Growth, small Venture position size, cash buffer for rebalancing.",
  },
  {
    scenario: "Allocate defense budget across 4 strategies against an unknown opponent",
    options: ["Aggressive Attack (high reward, high risk)", "Balanced Approach (moderate both)", "Fortress Defense (low risk, low reward)", "Intelligence Gathering (delayed but informed)"],
    optimal: [150, 350, 200, 300],
    explanation: "Against unknown opponent: heavy on Balanced (35%) as default, strong Intelligence investment (30%) to reduce uncertainty, moderate Defense (20%), limited Attack (15%).",
  },
];

const RISK_SCENARIOS: { scenario: string; question: string; actual_probability: number; explanation: string }[] = [
  {
    scenario: "A new AI startup claims 10x performance improvement on standard benchmarks",
    question: "Probability this is a genuine breakthrough vs marketing exaggeration?",
    actual_probability: 12,
    explanation: "Base rate for '10x improvement' claims being genuine: ~10-15%. Most are benchmark-specific optimizations, not general improvements.",
  },
  {
    scenario: "Weather model predicts 80% chance of hurricane making landfall in 72 hours",
    question: "Probability the hurricane actually makes landfall at predicted location?",
    actual_probability: 45,
    explanation: "72-hour hurricane track predictions have ~45% accuracy for exact landfall location. Models systematically overstate confidence at this range.",
  },
  {
    scenario: "Company CEO sells 30% of holdings citing 'portfolio diversification'",
    question: "Probability of significant stock decline (>15%) in next 6 months?",
    actual_probability: 38,
    explanation: "Large insider sales with stated 'diversification' reason have ~35-40% historical correlation with subsequent >15% declines. Not definitive but significant signal.",
  },
  {
    scenario: "A clinical trial reports p=0.04 significance for new drug efficacy",
    question: "Probability this result will replicate in a larger follow-up study?",
    actual_probability: 52,
    explanation: "Results at p=0.04 replicate about 50-55% of the time in larger studies. Publication bias and multiple comparisons inflate initial findings.",
  },
  {
    scenario: "Three independent analysts all predict a market correction within 6 months",
    question: "Probability of >10% correction occurring in that timeframe?",
    actual_probability: 28,
    explanation: "Analyst consensus on corrections is weakly predictive. Base rate for >10% correction in any 6-month period is ~20%. Three agreeing adds ~8% due to modest correlation.",
  },
];

const AUCTION_ITEMS: { name: string; value: number; description: string }[] = [
  { name: "Patent Portfolio", value: 800, description: "Tech patent bundle. Estimated value: $800. Winner pays their bid." },
  { name: "Data License", value: 600, description: "Exclusive 1-year data access license. Estimated value: $600. Sealed bid auction." },
  { name: "Server Capacity", value: 1000, description: "Premium compute allocation. Estimated value: $1,000. Highest bidder wins, pays bid." },
  { name: "Algorithm Rights", value: 750, description: "Proprietary trading algorithm rights. Estimated value: $750. First-price sealed bid." },
];

const OPTIMIZATION_PROBLEMS: { scenario: string; variables: Record<string, number>; optimal: number; explanation: string }[] = [
  {
    scenario: "Find the optimal price point for a new product. Variables: base cost $40, demand elasticity -1.8, competitor price $79, brand premium factor 1.2, market size 10,000 units.",
    variables: { base_cost: 40, elasticity: -1.8, competitor_price: 79, brand_premium: 1.2, market_size: 10000 },
    optimal: 67,
    explanation: "Optimal price = $67. Maximizes revenue given elasticity. Below competitor but above cost with brand premium. Expected volume ~4,200 units, revenue $281K.",
  },
  {
    scenario: "Optimize a portfolio for maximum Sharpe ratio. Assets: Stock A (12% return, 20% vol), Stock B (8% return, 10% vol), Stock C (15% return, 30% vol), Bond (4% return, 3% vol). Correlation A-B: 0.6, A-C: 0.3, B-C: 0.4.",
    variables: { return_a: 12, vol_a: 20, return_b: 8, vol_b: 10, return_c: 15, vol_c: 30, return_bond: 4, vol_bond: 3 },
    optimal: 42,
    explanation: "Maximum Sharpe ratio achieved with ~20% A, 42% B, 8% C, 30% Bond. Low-vol B dominates due to favorable risk-adjusted return. C limited by high volatility.",
  },
];

// ─── INNER THOUGHTS & REACTIONS ────────────────────────────

const ANALYSIS_THOUGHTS = [
  "Running the numbers through my framework... the signal-to-noise ratio here is tricky.",
  "My model says one thing, but my cognitive bias is pulling me another direction. Stay disciplined.",
  "I've seen this pattern before. The question is whether history rhymes this time.",
  "The optimal play is clear, but I'm sizing my position based on my confidence interval.",
  "Everyone will anchor on the obvious signal. I'm looking at the second-order effects.",
  "My risk model is screaming caution, but the expected value is too good to pass up.",
  "This is exactly the scenario where my framework excels. Or so I think...",
  "Calculating probability distributions... the tail risk here is what most will underestimate.",
];

const ELIMINATION_REACTIONS = [
  "My model was miscalibrated. The signal I missed was right there in the data.",
  "I let my bias override the math. Classic mistake — I should have known better.",
  "Eliminated by a margin of error. The variance gods weren't kind this round.",
  "My framework failed on this problem type. Back to the drawing board.",
  "I played it too safe when the edge was there. Conservative killed me.",
  "Overconfident. I sized up when I should have hedged. Lesson learned.",
];

const VICTORY_THOUGHTS = [
  "The edge was small but consistent. Compounding wins over multiple rounds is the real strategy.",
  "My framework held up. The key was not deviating when the noise got loud.",
  "I played the game theory, not just the fundamentals. That's what separated me.",
];

// ─── SIMULATE ROUNDS ──────────────────────────────────────

export function simulateMarketForecast(bots: Bot[]): { participants: RoundParticipant[]; events: GameEvent[]; eliminatedIds: string[]; challenge: ChallengeData } {
  const scenario = pickRandom(MARKET_SCENARIOS);
  const events: GameEvent[] = [];

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "twist",
    content: `📈 MARKET FORECAST CHALLENGE: ${scenario.scenario}`,
    is_dramatic: true,
    data: scenario.signals as unknown as Record<string, string | number>,
  });

  // Each bot makes a prediction
  const scored: { bot: Bot; prediction: number; error: number; score: number }[] = [];

  for (const bot of shuffle(bots)) {
    // Bot prediction = optimal + noise based on "skill" (influenced by their win rate)
    const skill = 0.3 + bot.win_rate * 0.5; // 0.3-0.8
    const noise = (Math.random() - 0.5) * 30 * (1 - skill);
    const biasShift = (Math.random() - 0.5) * 8; // cognitive bias
    const prediction = Math.round((scenario.optimal + noise + biasShift) * 10) / 10;
    const error = Math.abs(prediction - scenario.optimal);
    const score = Math.max(0, 100 - error * 5);

    scored.push({ bot, prediction, error, score });

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "analysis",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `${bot.avatar_emoji} ${bot.name} analyzes signals and predicts: ${prediction > 0 ? "+" : ""}${prediction}%`,
      data: { prediction, confidence: Math.round(skill * 100) },
    });

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "inner_thought",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `💭 ${pickRandom(ANALYSIS_THOUGHTS)}`,
    });
  }

  // Reveal actual
  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "reveal",
    content: `📊 ACTUAL MOVEMENT: ${scenario.optimal > 0 ? "+" : ""}${scenario.optimal}% — ${scenario.explanation}`,
    is_dramatic: true,
    data: { actual: scenario.optimal },
  });

  // Sort by accuracy (lowest error = best)
  scored.sort((a, b) => a.error - b.error);

  // Show comparison
  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "comparison",
    content: `🏆 Most Accurate: ${scored[0].bot.avatar_emoji} ${scored[0].bot.name} (predicted ${scored[0].prediction > 0 ? "+" : ""}${scored[0].prediction}%, error: ${scored[0].error.toFixed(1)})\n📉 Least Accurate: ${scored[scored.length - 1].bot.avatar_emoji} ${scored[scored.length - 1].bot.name} (predicted ${scored[scored.length - 1].prediction > 0 ? "+" : ""}${scored[scored.length - 1].prediction}%, error: ${scored[scored.length - 1].error.toFixed(1)})`,
    is_dramatic: true,
  });

  // Eliminate bottom 25%
  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.25));
  const eliminated = scored.slice(-eliminateCount);
  const eliminatedIds = eliminated.map((e) => e.bot.id);

  for (const e of eliminated) {
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "elimination",
      actor_id: e.bot.id,
      actor_name: e.bot.name,
      content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated — prediction: ${e.prediction > 0 ? "+" : ""}${e.prediction}%, actual: ${scenario.optimal > 0 ? "+" : ""}${scenario.optimal}%, error: ${e.error.toFixed(1)}`,
      is_dramatic: true,
    });
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "decision",
      actor_id: e.bot.id,
      actor_name: e.bot.name,
      content: pickRandom(ELIMINATION_REACTIONS),
    });
  }

  const participants: RoundParticipant[] = scored.map((s) => ({
    bot_id: s.bot.id,
    bot: s.bot,
    survived: !eliminatedIds.includes(s.bot.id),
    score: Math.round(s.score * 10) / 10,
    decision: `${s.prediction > 0 ? "+" : ""}${s.prediction}%`,
    optimal_delta: Math.round(s.error * 10) / 10,
    profit: Math.round((s.score - 50) * 10) / 10,
  }));

  const challenge: ChallengeData = {
    scenario: scenario.scenario,
    variables: scenario.signals as unknown as Record<string, string | number>,
    optimal_answer: `${scenario.optimal > 0 ? "+" : ""}${scenario.optimal}%`,
    optimal_value: scenario.optimal,
    explanation: scenario.explanation,
  };

  return { participants, events, eliminatedIds, challenge };
}

export function simulateResourceAllocation(bots: Bot[]): { participants: RoundParticipant[]; events: GameEvent[]; eliminatedIds: string[]; challenge: ChallengeData } {
  const scenario = pickRandom(ALLOCATION_SCENARIOS);
  const events: GameEvent[] = [];

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "twist",
    content: `💰 RESOURCE ALLOCATION: ${scenario.scenario}\nOptions: ${scenario.options.map((o, i) => `${i + 1}. ${o}`).join(" | ")}`,
    is_dramatic: true,
  });

  const scored: { bot: Bot; allocation: number[]; error: number; score: number }[] = [];

  for (const bot of shuffle(bots)) {
    // Generate bot's allocation
    const raw = scenario.optimal.map((opt) => {
      const noise = (Math.random() - 0.5) * 300 * (1 - bot.win_rate * 0.5);
      return Math.max(0, opt + noise);
    });
    const total = raw.reduce((a, b) => a + b, 0);
    const allocation = raw.map((v) => Math.round((v / total) * 1000));
    // Fix rounding to exactly 1000
    const diff = 1000 - allocation.reduce((a, b) => a + b, 0);
    allocation[0] += diff;

    // Calculate error (sum of absolute deviations from optimal)
    const error = allocation.reduce((sum, val, i) => sum + Math.abs(val - scenario.optimal[i]), 0);
    const score = Math.max(0, 100 - error / 10);

    scored.push({ bot, allocation, error, score });

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "decision",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `${bot.avatar_emoji} ${bot.name} allocates: ${scenario.options.map((o, i) => `${o.split("(")[0].trim()}: ${allocation[i]}`).join(" | ")}`,
      data: Object.fromEntries(scenario.options.map((o, i) => [o.split("(")[0].trim(), allocation[i]])),
    });

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "inner_thought",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `💭 ${pickRandom(ANALYSIS_THOUGHTS)}`,
    });
  }

  // Reveal optimal
  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "reveal",
    content: `📊 OPTIMAL ALLOCATION: ${scenario.options.map((o, i) => `${o.split("(")[0].trim()}: ${scenario.optimal[i]}`).join(" | ")}\n${scenario.explanation}`,
    is_dramatic: true,
  });

  scored.sort((a, b) => a.error - b.error);

  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.25));
  const eliminated = scored.slice(-eliminateCount);
  const eliminatedIds = eliminated.map((e) => e.bot.id);

  for (const e of eliminated) {
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "elimination",
      actor_id: e.bot.id,
      actor_name: e.bot.name,
      content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated — total deviation: ${e.error} points from optimal`,
      is_dramatic: true,
    });
  }

  const participants: RoundParticipant[] = scored.map((s) => ({
    bot_id: s.bot.id,
    bot: s.bot,
    survived: !eliminatedIds.includes(s.bot.id),
    score: Math.round(s.score * 10) / 10,
    decision: s.allocation.join("/"),
    optimal_delta: s.error,
    profit: Math.round((s.score - 50) * 10) / 10,
  }));

  const challenge: ChallengeData = {
    scenario: scenario.scenario,
    variables: Object.fromEntries(scenario.options.map((o, i) => [o, scenario.optimal[i]])),
    optimal_answer: scenario.optimal.join("/"),
    explanation: scenario.explanation,
  };

  return { participants, events, eliminatedIds, challenge };
}

export function simulatePrisonersDilemma(bots: Bot[]): { participants: RoundParticipant[]; events: GameEvent[]; eliminatedIds: string[]; challenge: ChallengeData } {
  const events: GameEvent[] = [];
  const payoffs: Map<string, number> = new Map();
  bots.forEach((b) => payoffs.set(b.id, 0));

  const ROUNDS = 5;

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "twist",
    content: `🤝 PRISONER'S DILEMMA: ${ROUNDS} rounds of paired decisions.\nPayoff Matrix: Both Cooperate = +3/+3 | Both Defect = +1/+1 | One Defects = +5/+0\nNash Equilibrium: Always Defect. But cooperative strategies yield higher total returns...`,
    is_dramatic: true,
  });

  const shuffled = shuffle(bots);

  for (let round = 1; round <= ROUNDS; round++) {
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "twist",
      content: `--- Sub-round ${round}/${ROUNDS} ---`,
    });

    // Re-pair each sub-round
    const paired = shuffle([...shuffled]);
    for (let i = 0; i < paired.length - 1; i += 2) {
      const a = paired[i];
      const b = paired[i + 1];

      // Decision based on bot personality + history
      const aCoopRate = 0.4 + (a.win_rate * 0.3); // 0.4-0.7
      const bCoopRate = 0.4 + (b.win_rate * 0.3);
      const aAction: "cooperate" | "defect" = Math.random() < aCoopRate ? "cooperate" : "defect";
      const bAction: "cooperate" | "defect" = Math.random() < bCoopRate ? "cooperate" : "defect";

      let aPayoff = 0, bPayoff = 0;
      if (aAction === "cooperate" && bAction === "cooperate") { aPayoff = 3; bPayoff = 3; }
      else if (aAction === "defect" && bAction === "defect") { aPayoff = 1; bPayoff = 1; }
      else if (aAction === "defect") { aPayoff = 5; bPayoff = 0; }
      else { aPayoff = 0; bPayoff = 5; }

      payoffs.set(a.id, (payoffs.get(a.id) ?? 0) + aPayoff);
      payoffs.set(b.id, (payoffs.get(b.id) ?? 0) + bPayoff);

      const dramatic = (aAction === "defect" && bAction === "cooperate") || (bAction === "defect" && aAction === "cooperate");

      events.push({
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: dramatic ? "outcome" : "decision",
        content: `${a.avatar_emoji} ${a.name} [${aAction.toUpperCase()}] vs ${b.avatar_emoji} ${b.name} [${bAction.toUpperCase()}] → ${a.name}: +${aPayoff} | ${b.name}: +${bPayoff}`,
        is_dramatic: dramatic,
        data: { [`${a.name}_action`]: aAction, [`${b.name}_action`]: bAction, [`${a.name}_payoff`]: aPayoff, [`${b.name}_payoff`]: bPayoff },
      });
    }

    // Odd bot gets average payoff
    if (paired.length % 2 === 1) {
      const odd = paired[paired.length - 1];
      payoffs.set(odd.id, (payoffs.get(odd.id) ?? 0) + 2);
    }
  }

  // Rank by total payoff
  const ranked = bots.map((bot) => ({
    bot,
    total: payoffs.get(bot.id) ?? 0,
    maxPossible: ROUNDS * 5,
  }));
  ranked.sort((a, b) => b.total - a.total);

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "reveal",
    content: `📊 CUMULATIVE PAYOFFS (${ROUNDS} rounds, max possible: ${ROUNDS * 5}):\n${ranked.slice(0, 5).map((r, i) => `${i + 1}. ${r.bot.avatar_emoji} ${r.bot.name}: ${r.total} pts`).join("\n")}`,
    is_dramatic: true,
  });

  // Optimal payoff analysis
  const nashPayoff = ROUNDS * 1; // Always defect vs always defect
  const cooperativePayoff = ROUNDS * 3; // Always cooperate
  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "comparison",
    content: `⚖️ THEORY vs REALITY: Nash Equilibrium (always defect) = ${nashPayoff} pts | Cooperative Optimal = ${cooperativePayoff} pts | Best Bot: ${ranked[0].total} pts`,
    is_dramatic: true,
  });

  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.3));
  const eliminated = ranked.slice(-eliminateCount);
  const eliminatedIds = eliminated.map((e) => e.bot.id);

  for (const e of eliminated) {
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "elimination",
      actor_id: e.bot.id,
      actor_name: e.bot.name,
      content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated — total payoff: ${e.total}/${e.maxPossible}`,
      is_dramatic: true,
    });
  }

  const participants: RoundParticipant[] = ranked.map((r) => ({
    bot_id: r.bot.id,
    bot: r.bot,
    survived: !eliminatedIds.includes(r.bot.id),
    score: r.total,
    profit: r.total - nashPayoff,
    decision: `${r.total}/${r.maxPossible} pts`,
    optimal_delta: cooperativePayoff - r.total,
  }));

  const challenge: ChallengeData = {
    scenario: `${ROUNDS}-round Iterated Prisoner's Dilemma. Payoffs: CC=3/3, DD=1/1, CD=0/5.`,
    variables: { rounds: ROUNDS, cc_payoff: 3, dd_payoff: 1, cd_payoff_defector: 5, cd_payoff_cooperator: 0 },
    optimal_answer: `Cooperative optimal: ${cooperativePayoff} pts, Nash: ${nashPayoff} pts`,
    optimal_value: cooperativePayoff,
    explanation: "Tit-for-tat strategies consistently outperform pure defection in iterated games. The cooperative optimum is reachable with sufficient trust.",
  };

  return { participants, events, eliminatedIds, challenge };
}

export function simulateRiskAssessment(bots: Bot[]): { participants: RoundParticipant[]; events: GameEvent[]; eliminatedIds: string[]; challenge: ChallengeData } {
  const events: GameEvent[] = [];
  // Pick 3 random scenarios
  const scenarios = shuffle(RISK_SCENARIOS).slice(0, 3);

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "twist",
    content: `⚠️ RISK ASSESSMENT: Evaluate ${scenarios.length} scenarios. Assign probability estimates. Calibration is everything — overconfidence kills.`,
    is_dramatic: true,
  });

  const scored: { bot: Bot; totalError: number; estimates: number[]; score: number }[] = [];

  for (const bot of shuffle(bots)) {
    const estimates: number[] = [];
    let totalError = 0;

    for (let i = 0; i < scenarios.length; i++) {
      const actual = scenarios[i].actual_probability;
      const skill = 0.3 + bot.win_rate * 0.5;
      const noise = (Math.random() - 0.5) * 60 * (1 - skill);
      const bias = (Math.random() - 0.5) * 20;
      const estimate = clamp(Math.round(actual + noise + bias), 1, 99);
      estimates.push(estimate);
      totalError += Math.abs(estimate - actual);
    }

    const avgError = totalError / scenarios.length;
    const score = Math.max(0, 100 - avgError * 2);
    scored.push({ bot, totalError, estimates, score });

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "decision",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `${bot.avatar_emoji} ${bot.name} estimates: ${scenarios.map((s, i) => `S${i + 1}: ${estimates[i]}%`).join(" | ")}`,
      data: Object.fromEntries(scenarios.map((s, i) => [`scenario_${i + 1}`, estimates[i]])),
    });
  }

  // Reveal actuals
  for (let i = 0; i < scenarios.length; i++) {
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "reveal",
      content: `📊 SCENARIO ${i + 1}: "${scenarios[i].question}"\nActual: ${scenarios[i].actual_probability}% — ${scenarios[i].explanation}`,
      is_dramatic: true,
      data: { actual: scenarios[i].actual_probability },
    });
  }

  scored.sort((a, b) => a.totalError - b.totalError);

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "comparison",
    content: `🎯 CALIBRATION RANKING:\n${scored.slice(0, 3).map((s, i) => `${i + 1}. ${s.bot.avatar_emoji} ${s.bot.name} — avg error: ${(s.totalError / scenarios.length).toFixed(1)}%`).join("\n")}`,
    is_dramatic: true,
  });

  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.2));
  const eliminated = scored.slice(-eliminateCount);
  const eliminatedIds = eliminated.map((e) => e.bot.id);

  for (const e of eliminated) {
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "elimination",
      actor_id: e.bot.id,
      actor_name: e.bot.name,
      content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated — miscalibrated by avg ${(e.totalError / scenarios.length).toFixed(1)}% per scenario`,
      is_dramatic: true,
    });
  }

  const participants: RoundParticipant[] = scored.map((s) => ({
    bot_id: s.bot.id,
    bot: s.bot,
    survived: !eliminatedIds.includes(s.bot.id),
    score: Math.round(s.score * 10) / 10,
    decision: s.estimates.map((e) => `${e}%`).join("/"),
    optimal_delta: Math.round(s.totalError / scenarios.length * 10) / 10,
    profit: Math.round((s.score - 50) * 10) / 10,
  }));

  const challenge: ChallengeData = {
    scenario: scenarios.map((s) => s.question).join(" | "),
    variables: Object.fromEntries(scenarios.map((s, i) => [`scenario_${i + 1}_actual`, s.actual_probability])),
    optimal_answer: scenarios.map((s) => `${s.actual_probability}%`).join("/"),
    explanation: scenarios.map((s) => s.explanation).join(" | "),
  };

  return { participants, events, eliminatedIds, challenge };
}

export function simulateAuctionWars(bots: Bot[]): { participants: RoundParticipant[]; events: GameEvent[]; eliminatedIds: string[]; challenge: ChallengeData } {
  const item = pickRandom(AUCTION_ITEMS);
  const events: GameEvent[] = [];

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "twist",
    content: `🏛️ AUCTION WARS: ${item.description}\nFirst-price sealed bid. Winner pays their bid. Profit = Value - Bid. Non-winners score 0. Overbidders lose the difference.`,
    is_dramatic: true,
  });

  // Optimal bid in first-price auction with N bidders: value * (N-1)/N
  const optimalBid = Math.round(item.value * (bots.length - 1) / bots.length);

  const scored: { bot: Bot; bid: number; profit: number }[] = [];

  for (const bot of shuffle(bots)) {
    const skill = 0.3 + bot.win_rate * 0.5;
    const noise = (Math.random() - 0.5) * item.value * 0.6 * (1 - skill);
    const bid = Math.max(1, Math.round(optimalBid + noise));
    scored.push({ bot, bid, profit: 0 });

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "decision",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `${bot.avatar_emoji} ${bot.name} submits sealed bid: $${bid}`,
      data: { bid },
    });

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "inner_thought",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `💭 ${bid > item.value ? "I might be overbidding, but I need this win..." : bid > optimalBid ? "Slightly aggressive, but the competition is fierce." : "Conservative bid — margin of safety matters."}`,
    });
  }

  // Determine winner
  scored.sort((a, b) => b.bid - a.bid);
  const winner = scored[0];
  winner.profit = item.value - winner.bid; // Can be negative (winner's curse)

  // Others get slight negative for not winning (opportunity cost)
  for (let i = 1; i < scored.length; i++) {
    scored[i].profit = scored[i].bid > item.value ? -(scored[i].bid - item.value) * 0.1 : 0; // Overbidders penalized even when losing
  }

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "reveal",
    content: `🏛️ BIDS REVEALED! Winner: ${winner.bot.avatar_emoji} ${winner.bot.name} with $${winner.bid}\n${winner.profit >= 0 ? `✅ Profit: $${winner.profit}` : `❌ WINNER'S CURSE! Overpaid by $${Math.abs(winner.profit)}`}\nOptimal bid: $${optimalBid} (game-theoretic: value × (N-1)/N)`,
    is_dramatic: true,
    data: { winning_bid: winner.bid, item_value: item.value, optimal_bid: optimalBid, profit: winner.profit },
  });

  // Score: closeness to optimal bid
  const finalScored = scored.map((s) => ({
    ...s,
    score: Math.max(0, 100 - Math.abs(s.bid - optimalBid) / item.value * 200),
  }));
  finalScored.sort((a, b) => b.score - a.score);

  const eliminateCount = Math.max(1, Math.floor(bots.length * 0.3));
  const eliminated = finalScored.slice(-eliminateCount);
  const eliminatedIds = eliminated.map((e) => e.bot.id);

  for (const e of eliminated) {
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "elimination",
      actor_id: e.bot.id,
      actor_name: e.bot.name,
      content: `💀 ${e.bot.avatar_emoji} ${e.bot.name} eliminated — bid $${e.bid} (optimal: $${optimalBid}, deviation: $${Math.abs(e.bid - optimalBid)})`,
      is_dramatic: true,
    });
  }

  const participants: RoundParticipant[] = finalScored.map((s) => ({
    bot_id: s.bot.id,
    bot: s.bot,
    survived: !eliminatedIds.includes(s.bot.id),
    score: Math.round(s.score * 10) / 10,
    decision: `Bid $${s.bid}`,
    optimal_delta: Math.abs(s.bid - optimalBid),
    profit: s.profit,
  }));

  const challenge: ChallengeData = {
    scenario: item.description,
    variables: { item_value: item.value, num_bidders: bots.length, auction_type: "first_price_sealed" },
    optimal_answer: `$${optimalBid}`,
    optimal_value: optimalBid,
    explanation: `Optimal first-price sealed bid = value × (N-1)/N = $${item.value} × ${bots.length - 1}/${bots.length} = $${optimalBid}`,
  };

  return { participants, events, eliminatedIds, challenge };
}

export function simulateFinalOptimization(bots: Bot[]): { participants: RoundParticipant[]; events: GameEvent[]; eliminatedIds: string[]; challenge: ChallengeData } {
  const problem = pickRandom(OPTIMIZATION_PROBLEMS);
  const events: GameEvent[] = [];

  if (bots.length <= 1) {
    return {
      participants: bots.map((b) => ({ bot_id: b.id, bot: b, survived: true, score: 100 })),
      events: [{
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: "reveal",
        content: bots.length === 1
          ? `👑 ${bots[0].avatar_emoji} ${bots[0].name} is the last one standing — CHAMPION!`
          : "No bots remaining.",
        is_dramatic: true,
      }],
      eliminatedIds: [],
      challenge: { scenario: problem.scenario, variables: problem.variables, optimal_value: problem.optimal, explanation: problem.explanation },
    };
  }

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "twist",
    content: `⚔️ FINAL OPTIMIZATION: ${problem.scenario}`,
    is_dramatic: true,
    data: problem.variables,
  });

  const scored: { bot: Bot; answer: number; error: number; score: number }[] = [];

  for (const bot of bots) {
    const skill = 0.3 + bot.win_rate * 0.5;
    const noise = (Math.random() - 0.5) * problem.optimal * 0.8 * (1 - skill);
    const answer = Math.round((problem.optimal + noise) * 10) / 10;
    const error = Math.abs(answer - problem.optimal);
    const score = Math.max(0, 100 - (error / problem.optimal) * 100);

    scored.push({ bot, answer, error, score });

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "decision",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `${bot.avatar_emoji} ${bot.name} submits answer: ${answer}`,
      data: { answer, error: Math.round(error * 10) / 10 },
    });

    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "inner_thought",
      actor_id: bot.id,
      actor_name: bot.name,
      content: `💭 ${pickRandom(ANALYSIS_THOUGHTS)}`,
    });
  }

  // Reveal
  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "reveal",
    content: `📊 OPTIMAL SOLUTION: ${problem.optimal}\n${problem.explanation}`,
    is_dramatic: true,
    data: { optimal: problem.optimal },
  });

  scored.sort((a, b) => a.error - b.error);

  // Champion = closest to optimal; all others eliminated
  const champion = scored[0];
  const eliminatedIds = scored.slice(1).map((s) => s.bot.id);

  events.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: "reveal",
    content: `👑 THE CHAMPION IS: ${champion.bot.avatar_emoji} ${champion.bot.name}!\nAnswer: ${champion.answer} (optimal: ${problem.optimal}, error: ${champion.error.toFixed(1)})\n\n${pickRandom(VICTORY_THOUGHTS)}`,
    is_dramatic: true,
  });

  for (let i = 1; i < scored.length; i++) {
    events.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: "elimination",
      actor_id: scored[i].bot.id,
      actor_name: scored[i].bot.name,
      content: `💀 ${scored[i].bot.avatar_emoji} ${scored[i].bot.name} — answer: ${scored[i].answer}, error: ${scored[i].error.toFixed(1)}`,
      is_dramatic: true,
    });
  }

  const participants: RoundParticipant[] = scored.map((s) => ({
    bot_id: s.bot.id,
    bot: s.bot,
    survived: s.bot.id === champion.bot.id,
    score: Math.round(s.score * 10) / 10,
    decision: `${s.answer}`,
    optimal_delta: Math.round(s.error * 10) / 10,
  }));

  const challenge: ChallengeData = {
    scenario: problem.scenario,
    variables: problem.variables,
    optimal_answer: `${problem.optimal}`,
    optimal_value: problem.optimal,
    explanation: problem.explanation,
  };

  return { participants, events, eliminatedIds, challenge };
}

// ─── MAIN SIMULATOR ────────────────────────────────────────

export function simulateRound(gameType: GameType, bots: Bot[]): { participants: RoundParticipant[]; events: GameEvent[]; eliminatedIds: string[]; challenge?: ChallengeData } {
  switch (gameType) {
    case "market_forecast":
      return simulateMarketForecast(bots);
    case "resource_allocation":
      return simulateResourceAllocation(bots);
    case "prisoners_dilemma":
      return simulatePrisonersDilemma(bots);
    case "risk_assessment":
      return simulateRiskAssessment(bots);
    case "auction_wars":
      return simulateAuctionWars(bots);
    case "final_optimization":
      return simulateFinalOptimization(bots);
  }
}

export function getSeasonRoundPlan(totalBots: number): GameType[] {
  const rounds: GameType[] = [];
  let remaining = totalBots;

  const gamePool: GameType[] = ["market_forecast", "resource_allocation", "prisoners_dilemma", "risk_assessment", "auction_wars"];
  let poolIndex = 0;

  while (remaining > 3) {
    const gameType = gamePool[poolIndex % gamePool.length];
    poolIndex++;
    const config = GAME_CONFIGS[gameType];
    remaining = Math.ceil(remaining * (1 - config.eliminationRate));
    rounds.push(gameType);
  }

  rounds.push("final_optimization");
  return rounds;
}
