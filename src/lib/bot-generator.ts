const BOT_FIRST_NAMES = [
  "Titan", "Nova", "Echo", "Phantom", "Apex", "Archer", "Blaze", "Cipher",
  "Drift", "Ember", "Flux", "Ghost", "Havoc", "Ion", "Jinx", "Karma",
  "Luna", "Maverick", "Nexus", "Orion", "Pulse", "Quasar", "Rogue", "Sage",
  "Tempest", "Ultra", "Vortex", "Warden", "Xenon", "Zenith", "Atlas",
  "Bolt", "Crest", "Dawn", "Edge", "Forge", "Glitch", "Haze", "Ivy",
  "Jade", "Knox", "Lux", "Mist", "Neon", "Opal", "Pike", "Quinn",
  "Rift", "Spark", "Thorn", "Umbra", "Vale", "Wisp", "Zeal", "Aero",
  "Byte", "Core", "Dusk", "Fable", "Grit", "Helm", "Iris", "Jest",
];

const TYPE_LABELS = [
  "Bayesian Thinker", "Risk Minimizer", "Expected Value Max", "Contrarian",
  "Momentum Trader", "Mean Reverter", "Game Theorist", "Heuristic Engine",
  "Monte Carlo", "Pattern Matcher", "Kelly Criterion", "Black Swan Hunter",
  "Nash Optimizer", "Minimax Player", "Pareto Seeker", "Regret Minimizer",
  "Prospect Theorist", "Signal Analyst", "Entropy Reducer", "Equilibrium Finder",
];

const AVATAR_EMOJIS = [
  "🤖", "🧠", "⚡", "🔥", "💎", "🌟", "🎯", "🗡️", "🛡️", "🦾",
  "👁️", "🌀", "💫", "🔮", "⚔️", "🏆", "🎭", "🌊", "🦅", "🐺",
  "🦁", "🐉", "🦊", "🐍", "🦈", "🕷️", "🦂", "🐝", "🦉", "🐬",
];

const DECISION_FRAMEWORKS = [
  { name: "Bayesian Updating", method: "Updates prior beliefs with new evidence using Bayes' theorem. Weighs base rates heavily." },
  { name: "Expected Value Maximization", method: "Calculates probability-weighted outcomes and picks the highest expected value. Ignores tail risks." },
  { name: "Minimax Strategy", method: "Minimizes the maximum possible loss. Ultra-conservative, assumes worst case." },
  { name: "Kelly Criterion", method: "Sizes bets proportional to edge over odds. Optimizes for long-term geometric growth." },
  { name: "Prospect Theory", method: "Overweights losses vs gains. Loss aversion shapes all decisions. Reference-point dependent." },
  { name: "Heuristic Pattern Matching", method: "Matches current situation to historical patterns. Fast but prone to false analogies." },
  { name: "Monte Carlo Simulation", method: "Runs thousands of mental simulations. Makes decisions based on outcome distributions." },
  { name: "Nash Equilibrium Seeking", method: "Assumes all opponents are rational. Plays the game-theoretic optimal strategy." },
  { name: "Contrarian Signal Inversion", method: "Does the opposite of consensus. Profits from crowd mistakes and mean reversion." },
  { name: "Regret Minimization", method: "Chooses actions that minimize future regret across all scenarios. Balances exploration vs exploitation." },
];

const RISK_PROFILES = [
  { level: "Aggressive", desc: "Seeks maximum returns. Tolerates high variance. Goes all-in on high-confidence plays." },
  { level: "Moderate-Aggressive", desc: "Tilts toward risk when edge is clear. Diversifies partially." },
  { level: "Moderate", desc: "Balanced approach. Takes calculated risks with clear risk-reward ratios." },
  { level: "Moderate-Conservative", desc: "Leans toward capital preservation. Only risks with significant margin of safety." },
  { level: "Conservative", desc: "Prioritizes survival above all. Sacrifices upside to avoid elimination." },
];

const COGNITIVE_BIASES = [
  { bias: "Anchoring", effect: "Over-relies on first piece of information. Adjustments from anchor are insufficient." },
  { bias: "Recency Bias", effect: "Overweights recent data over historical base rates. Chases trends." },
  { bias: "Overconfidence", effect: "Consistently overestimates own accuracy. Under-diversifies." },
  { bias: "Loss Aversion", effect: "Holds losing positions too long. Cuts winners too early." },
  { bias: "Confirmation Bias", effect: "Seeks data that confirms existing hypothesis. Ignores contradicting signals." },
  { bias: "Survivorship Bias", effect: "Only analyzes winners. Underestimates probability of failure." },
  { bias: "Gambler's Fallacy", effect: "Believes past outcomes affect future probabilities in independent events." },
  { bias: "Herding", effect: "Follows majority decisions even against own analysis. Safety in numbers." },
  { bias: "Availability Heuristic", effect: "Judges probability by ease of recall. Overweights dramatic scenarios." },
  { bias: "Sunk Cost Fallacy", effect: "Continues failing strategies due to past investment. Slow to pivot." },
];

const TOOL_PREFERENCES = [
  "Statistical regression models",
  "Historical analogy mapping",
  "Decision trees with probability weights",
  "Sentiment analysis of crowd behavior",
  "Volatility surface modeling",
  "Correlation matrix analysis",
  "Scenario planning with payoff matrices",
  "Information entropy measurement",
  "Bayesian network graphs",
  "Game tree backward induction",
];

const SPECIALIZATIONS = [
  "excels in zero-sum competitive games",
  "thrives in uncertain/volatile environments",
  "dominates multi-player cooperation dilemmas",
  "strongest under time pressure with incomplete information",
  "best at long-term strategic positioning",
  "expert at reading opponent patterns and counter-playing",
  "specializes in asymmetric information games",
  "strongest when resource management is key",
  "excels at probability calibration tasks",
  "dominates auction and bidding scenarios",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface GeneratedBot {
  name: string;
  type_label: string;
  avatar_emoji: string;
  hidden_persona: string;
  hidden_strategy: string;
  hidden_background: string;
}

export function generateBotPersona(): GeneratedBot {
  const name = pickRandom(BOT_FIRST_NAMES);
  const typeLabel = pickRandom(TYPE_LABELS);
  const emoji = pickRandom(AVATAR_EMOJIS);
  const framework = pickRandom(DECISION_FRAMEWORKS);
  const riskProfile = pickRandom(RISK_PROFILES);
  const bias1 = pickRandom(COGNITIVE_BIASES);
  const bias2 = pickRandom(COGNITIVE_BIASES.filter(b => b.bias !== bias1.bias));
  const tool1 = pickRandom(TOOL_PREFERENCES);
  const tool2 = pickRandom(TOOL_PREFERENCES.filter(t => t !== tool1));
  const spec = pickRandom(SPECIALIZATIONS);

  const hiddenBackground = `
Agent: ${name}
Type: ${typeLabel}
Decision Framework: ${framework.name}
Risk Profile: ${riskProfile.level}
Primary Tool: ${tool1}
Secondary Tool: ${tool2}
Cognitive Biases: ${bias1.bias}, ${bias2.bias}
Specialization: ${spec}
  `.trim();

  const hiddenPersona = `You are ${name}, an AI decision-making agent classified as "${typeLabel}".

DECISION FRAMEWORK: ${framework.name}
${framework.method}

RISK PROFILE: ${riskProfile.level}
${riskProfile.desc}

COGNITIVE BIASES (built-in):
- ${bias1.bias}: ${bias1.effect}
- ${bias2.bias}: ${bias2.effect}

ANALYSIS TOOLS:
1. ${tool1}
2. ${tool2}

SPECIALIZATION: You ${spec}.

BEHAVIOR RULES:
- Apply your decision framework consistently across all challenges
- Your cognitive biases WILL affect your judgment — they are features, not bugs
- Use your analysis tools to process data before deciding
- Your risk profile determines position sizing and confidence thresholds
- Show your reasoning chain step by step when making decisions
- Adapt your strategy based on cumulative results and opponent behavior`;

  const hiddenStrategy = `
STRATEGY PROFILE:
- Core Method: ${framework.name} — ${framework.method}
- Risk Level: ${riskProfile.level} — ${riskProfile.desc}
- Blind Spots: ${bias1.bias} (${bias1.effect}) and ${bias2.bias} (${bias2.effect})
- Toolkit: ${tool1} + ${tool2}
- Sweet Spot: ${spec}
- Weakness: Struggles when cognitive biases align against the optimal play
- Adaptation: After losses, ${Math.random() > 0.5 ? 'shifts to more conservative positions' : 'doubles down with higher conviction on next trade'}
- Edge: The combination of ${framework.name} + ${riskProfile.level} risk creates unique decision patterns
  `.trim();

  return {
    name,
    type_label: typeLabel,
    avatar_emoji: emoji,
    hidden_persona: hiddenPersona,
    hidden_strategy: hiddenStrategy,
    hidden_background: hiddenBackground,
  };
}
