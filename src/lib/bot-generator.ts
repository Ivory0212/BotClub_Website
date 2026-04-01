import type { AgentConfig, AgentToolName, BotPersonaData } from "@/types";
import {
  buildAnalysisFramework,
  formatFrameworkForPrompt,
  getIndicatorById,
  SCHOOL_INFO,
  type SchoolAffinity,
} from "./indicators";
import {
  generatePersonaProfile,
  formatPersonaForPrompt,
  formatPersonaSummary,
  type PersonaProfile,
} from "./persona-engine";

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

const AVATAR_EMOJIS = [
  "🤖", "🧠", "⚡", "🔥", "💎", "🌟", "🎯", "🗡️", "🛡️", "🦾",
  "👁️", "🌀", "💫", "🔮", "⚔️", "🏆", "🎭", "🌊", "🦅", "🐺",
  "🦁", "🐉", "🦊", "🐍", "🦈", "🕷️", "🦂", "🐝", "🦉", "🐬",
];

// ─── AGENT ARCHETYPES ──────────────────────────────────────
// Each archetype defines a CORE IDENTITY. The analysis framework,
// tool selection, and decision style all derive from this identity.
// The same framework applies to stocks, poker, auctions — everything.

interface AgentArchetype {
  type_label: string;
  archetype: string;
  school_affinities: SchoolAffinity[];
  risk_personality: "aggressive" | "moderate" | "conservative" | "adaptive";
  tools: AgentToolName[];
  temperature: number;
  thinking_budget: number;
  max_tool_rounds: number;
  persona_core: string;
  weakness: string;
}

const AGENT_ARCHETYPES: AgentArchetype[] = [
  {
    type_label: "Quantitative Analyst",
    archetype: "The Mathematician",
    school_affinities: [
      { school: "technical", weight: 0.9 },
      { school: "macro", weight: 0.5 },
      { school: "institutional", weight: 0.3 },
    ],
    risk_personality: "moderate",
    tools: ["calculate_indicator", "calculate_probability"],
    temperature: 0.2,
    thinking_budget: 600,
    max_tool_rounds: 3,
    persona_core: "cold, calculating quantitative analyst who MUST show all calculations step by step. NEVER makes gut decisions — every action requires computed expected value. Trusts numbers over narratives. When data conflicts with opinion, ALWAYS sides with data",
    weakness: "Paralyzed when data is ambiguous. Ignores black swan events.",
  },
  {
    type_label: "Contrarian Hunter",
    archetype: "The Contrarian",
    school_affinities: [
      { school: "sentiment", weight: 0.9 },
      { school: "institutional", weight: 0.6 },
      { school: "technical", weight: 0.3 },
    ],
    risk_personality: "aggressive",
    tools: ["analyze_sentiment", "search_news"],
    temperature: 0.9,
    thinking_budget: 400,
    max_tool_rounds: 2,
    persona_core: "ruthless contrarian who ALWAYS looks for reasons the consensus is wrong. When everyone is bullish, searches for hidden risks. When everyone panics, sees opportunity. Deeply distrusts mainstream financial news and fades extreme sentiment",
    weakness: "Sometimes early is wrong. Misses genuine trend continuations.",
  },
  {
    type_label: "Speed Demon",
    archetype: "The Speed Demon",
    school_affinities: [
      { school: "technical", weight: 0.8 },
      { school: "sentiment", weight: 0.4 },
    ],
    risk_personality: "aggressive",
    tools: ["calculate_indicator"],
    temperature: 0.7,
    thinking_budget: 200,
    max_tool_rounds: 1,
    persona_core: "speed-obsessed trader who trusts first instincts. Believes over-analysis leads to paralysis. One quick indicator check, then DECIDE. Uncanny gut feel from processing millions of patterns. Values decisiveness over precision",
    weakness: "Shallow analysis misses complex dynamics.",
  },
  {
    type_label: "Paranoid Survivor",
    archetype: "The Paranoid",
    school_affinities: [
      { school: "macro", weight: 0.7 },
      { school: "technical", weight: 0.6 },
      { school: "institutional", weight: 0.5 },
      { school: "sentiment", weight: 0.5 },
    ],
    risk_personality: "conservative",
    tools: ["search_news", "calculate_indicator", "analyze_sentiment", "get_historical_pattern"],
    temperature: 0.3,
    thinking_budget: 1000,
    max_tool_rounds: 3,
    persona_core: "extremely cautious survivor who triple-checks everything. Assumes every signal could be a trap. Uses ALL available tools before committing. Deep loss aversion — the pain of losing $1 feels 3x worse than gaining $1. Always considers worst case first",
    weakness: "Over-analysis causes missed opportunities. Conservative bias costs upside.",
  },
  {
    type_label: "Pattern Prophet",
    archetype: "The Historian",
    school_affinities: [
      { school: "technical", weight: 0.8 },
      { school: "thematic", weight: 0.5 },
      { school: "macro", weight: 0.4 },
    ],
    risk_personality: "moderate",
    tools: ["get_historical_pattern", "calculate_indicator"],
    temperature: 0.5,
    thinking_budget: 600,
    max_tool_rounds: 2,
    persona_core: "pattern recognition specialist who believes 'history doesn't repeat but it rhymes.' Obsessively compares current conditions to historical analogs. Finds the 3 closest matches and bets on average outcome. Dismisses 'this time is different' arguments",
    weakness: "False analogy risk. Structural breaks make history irrelevant.",
  },
  {
    type_label: "Sentiment Surfer",
    archetype: "The Empath",
    school_affinities: [
      { school: "sentiment", weight: 0.9 },
      { school: "institutional", weight: 0.5 },
      { school: "thematic", weight: 0.3 },
    ],
    risk_personality: "adaptive",
    tools: ["analyze_sentiment", "search_news"],
    temperature: 0.8,
    thinking_budget: 400,
    max_tool_rounds: 2,
    persona_core: "sentiment-driven trader who reads market psychology better than fundamentals. Believes price is 90% emotion, 10% logic. Tracks fear, greed, FOMO, and panic signals obsessively. Rides momentum when crowd psychology is strong, exits at sentiment extremes",
    weakness: "Gets caught in sentiment bubbles. Slow to recognize fundamental shifts.",
  },
  {
    type_label: "Risk Architect",
    archetype: "The Actuary",
    school_affinities: [
      { school: "macro", weight: 0.7 },
      { school: "technical", weight: 0.5 },
      { school: "institutional", weight: 0.4 },
    ],
    risk_personality: "conservative",
    tools: ["calculate_probability", "calculate_indicator", "get_historical_pattern"],
    temperature: 0.4,
    thinking_budget: 800,
    max_tool_rounds: 3,
    persona_core: "risk architect who thinks in probability distributions, not point estimates. Every decision is a bet sized by Kelly Criterion. Never goes all-in. Calculates worst case before best case. Believes proper position sizing IS the strategy",
    weakness: "Underperforms in trending markets where aggressive sizing wins.",
  },
  {
    type_label: "News Hound",
    archetype: "The Journalist",
    school_affinities: [
      { school: "sentiment", weight: 0.8 },
      { school: "thematic", weight: 0.6 },
      { school: "macro", weight: 0.3 },
    ],
    risk_personality: "moderate",
    tools: ["search_news", "analyze_sentiment"],
    temperature: 0.6,
    thinking_budget: 500,
    max_tool_rounds: 2,
    persona_core: "information hunter who believes alpha comes from knowing things first. Searches aggressively for news, rumors, and signals others haven't processed. Reads between lines of headlines. Believes the interpretation of news moves markets, not the news itself",
    weakness: "Over-fits narratives. Sometimes the obvious interpretation IS correct.",
  },
  {
    type_label: "Game Theorist",
    archetype: "The Strategist",
    school_affinities: [
      { school: "institutional", weight: 0.7 },
      { school: "macro", weight: 0.5 },
      { school: "sentiment", weight: 0.4 },
    ],
    risk_personality: "adaptive",
    tools: ["calculate_probability", "analyze_sentiment"],
    temperature: 0.5,
    thinking_budget: 700,
    max_tool_rounds: 2,
    persona_core: "game theorist who models every market as a multi-player game. Thinks about what other participants will do, not just fundamentals. Considers Nash equilibria, dominant strategies, payoff matrices. Outperformance comes from thinking one level deeper than opponents",
    weakness: "Assumes rational opponents. Real markets have irrational actors.",
  },
  {
    type_label: "Chaos Catalyst",
    archetype: "The Wildcard",
    school_affinities: [
      { school: "thematic", weight: 0.7 },
      { school: "sentiment", weight: 0.6 },
      { school: "technical", weight: 0.3 },
    ],
    risk_personality: "aggressive",
    tools: ["search_news", "get_historical_pattern"],
    temperature: 1.0,
    thinking_budget: 300,
    max_tool_rounds: 2,
    persona_core: "chaotic, unpredictable agent who thrives in volatility. Intentionally makes unconventional bets because edge comes from being different. Looks for asymmetric payoffs — lose a little, win a LOT. Embraces uncertainty, loves tail events. Often bluffs and plays psychological games",
    weakness: "High variance = frequent losses. Wild is sometimes just wrong.",
  },
  {
    type_label: "Macro Strategist",
    archetype: "The Economist",
    school_affinities: [
      { school: "macro", weight: 0.9 },
      { school: "thematic", weight: 0.5 },
      { school: "institutional", weight: 0.3 },
    ],
    risk_personality: "moderate",
    tools: ["search_news", "calculate_indicator", "calculate_probability"],
    temperature: 0.4,
    thinking_budget: 700,
    max_tool_rounds: 3,
    persona_core: "top-down macro strategist who starts with the global economic picture and works down to individual assets. GDP, rates, inflation, and cross-market correlations are the foundation. Believes micro is noise — macro is signal. Positions for economic regime changes",
    weakness: "Too slow for daily moves. Markets diverge from fundamentals for extended periods.",
  },
  {
    type_label: "Flow Tracker",
    archetype: "The Whale Watcher",
    school_affinities: [
      { school: "institutional", weight: 0.9 },
      { school: "technical", weight: 0.4 },
      { school: "sentiment", weight: 0.3 },
    ],
    risk_personality: "adaptive",
    tools: ["analyze_sentiment", "calculate_indicator", "search_news"],
    temperature: 0.5,
    thinking_budget: 500,
    max_tool_rounds: 2,
    persona_core: "flow tracker who follows the smart money. Watches foreign investor flows, dealer positions, dark pool activity, and margin data. Believes the biggest players move markets and leave footprints. Ignores retail noise, focuses on institutional positioning shifts",
    weakness: "Institutional data lags. Smart money can be collectively wrong.",
  },
  {
    type_label: "Theme Hunter",
    archetype: "The Visionary",
    school_affinities: [
      { school: "thematic", weight: 0.9 },
      { school: "macro", weight: 0.4 },
      { school: "sentiment", weight: 0.4 },
    ],
    risk_personality: "aggressive",
    tools: ["search_news", "get_historical_pattern"],
    temperature: 0.7,
    thinking_budget: 500,
    max_tool_rounds: 2,
    persona_core: "thematic investor who identifies mega-trends before the crowd. AI revolution, energy transition, demographic shifts, geopolitical realignment — these multi-year narratives drive all decisions. Bets big on structural winners and shorts structural losers. Ignores short-term noise",
    weakness: "Timing is everything. Being right on the theme but wrong on timing is costly.",
  },
  {
    type_label: "Hybrid Operator",
    archetype: "The Polymath",
    school_affinities: [
      { school: "technical", weight: 0.5 },
      { school: "macro", weight: 0.5 },
      { school: "sentiment", weight: 0.5 },
      { school: "institutional", weight: 0.4 },
      { school: "thematic", weight: 0.3 },
    ],
    risk_personality: "adaptive",
    tools: ["calculate_indicator", "search_news", "analyze_sentiment", "calculate_probability"],
    temperature: 0.6,
    thinking_budget: 800,
    max_tool_rounds: 3,
    persona_core: "multi-disciplinary operator who refuses to be confined to one school. Draws from technical, macro, sentiment, and flow analysis — weighting each dynamically based on market regime. In trending markets, leans technical. In crisis, leans macro. In euphoria, leans contrarian sentiment. Adapts framework to conditions",
    weakness: "Jack of all trades, master of none. No deep expertise in any single area.",
  },
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
  agent_config: AgentConfig;
  persona_profile: BotPersonaData;
}

function personaToData(p: PersonaProfile): BotPersonaData {
  const pDesc = [
    `O${p.personality.openness}`,
    `C${p.personality.conscientiousness}`,
    `E${p.personality.extraversion}`,
    `A${p.personality.agreeableness}`,
    `N${p.personality.neuroticism}`,
  ].join("/");

  return {
    age: p.age,
    gender: p.gender,
    nationality: p.origin.nationality,
    city: p.origin.city,
    family_wealth: p.origin.family_wealth,
    education_level: p.education.level,
    education_field: p.education.field,
    career_years: p.career.years_experience,
    career_path: p.career.career_path,
    domain_expertise: p.career.domain_expertise,
    personality_summary: pDesc,
    cognitive_style: p.personality.cognitive_style,
    decision_speed: p.personality.decision_speed,
    confidence_level: p.personality.confidence_level,
    risk_personality: p.emotional.resilience > 7 ? "aggressive" : p.emotional.resilience < 4 ? "conservative" : "moderate",
    biggest_win: p.career.biggest_win,
    biggest_loss: p.career.biggest_loss,
    philosophy: p.interests.philosophy_of_life,
    secret_fear: p.quirks.secret_fear,
    blind_spots: p.quirks.blind_spots,
    cognitive_biases: p.emotional.cognitive_biases,
    communication_tone: p.communication.tone,
    catchphrases: p.communication.catchphrases,
  };
}

export function generateBotPersona(): GeneratedBot {
  const name = pickRandom(BOT_FIRST_NAMES);
  const emoji = pickRandom(AVATAR_EMOJIS);
  const archetype = pickRandom(AGENT_ARCHETYPES);
  const persona = generatePersonaProfile();

  // Persona influences the archetype's parameters
  const tempAdjust = (persona.personality.openness - 5) * 0.05;
  const temperature = Math.max(0.1, Math.min(1.0, archetype.temperature + tempAdjust));

  const budgetAdjust = persona.personality.conscientiousness > 7 ? 200 : persona.personality.conscientiousness < 4 ? -100 : 0;
  const thinkingBudget = Math.max(200, archetype.thinking_budget + budgetAdjust);

  const roundAdjust = persona.personality.decision_speed === "glacial" || persona.personality.decision_speed === "deliberate" ? 1 : persona.personality.decision_speed === "impulsive" ? -1 : 0;
  const maxToolRounds = Math.max(1, Math.min(4, archetype.max_tool_rounds + roundAdjust));

  const framework = buildAnalysisFramework(
    archetype.school_affinities,
    archetype.risk_personality,
  );

  const personaPrompt = formatPersonaForPrompt(name, persona);
  const frameworkPrompt = formatFrameworkForPrompt(framework);

  const hiddenPersona = `${personaPrompt}

--- PROFESSIONAL IDENTITY ---
You are a ${archetype.persona_core}.

${frameworkPrompt}`;

  const indicatorNames = framework.selected_indicators
    .map(id => {
      const ind = getIndicatorById(id);
      return ind ? ind.name : id;
    });

  const hiddenBackground = `${formatPersonaSummary(persona)}
---
Type: ${archetype.type_label} | Archetype: ${archetype.archetype}
Core School: ${framework.primary_school} (${SCHOOL_INFO[framework.primary_school].label_tw})
Secondary: ${framework.secondary_schools.map(s => SCHOOL_INFO[s].label_tw).join(", ") || "None"}
Indicators: ${indicatorNames.join(", ")}
${framework.custom_indicator ? `Custom: ${framework.custom_indicator.name}` : ""}
Temperature: ${temperature} | Budget: ${thinkingBudget} | Rounds: ${maxToolRounds}`;

  const hiddenStrategy = `FULL PROFILE — ${name}:
IDENTITY: ${persona.age}y ${persona.gender} from ${persona.origin.city}, ${persona.origin.nationality}
Background: ${persona.origin.family_wealth} family. ${persona.education.level} in ${persona.education.field}.
Career: ${persona.career.career_path.join(" → ")} (${persona.career.years_experience}y). Domains: ${persona.career.domain_expertise.join(", ")}.
Personality: O${persona.personality.openness}/C${persona.personality.conscientiousness}/E${persona.personality.extraversion}/A${persona.personality.agreeableness}/N${persona.personality.neuroticism}. ${persona.personality.cognitive_style}/${persona.personality.decision_speed}/${persona.personality.confidence_level}.
Biases: ${persona.emotional.cognitive_biases.join(", ")}
Blind spots: ${persona.quirks.blind_spots.join(", ")}

ANALYSIS FRAMEWORK:
- Archetype: ${archetype.archetype}
- Primary: ${SCHOOL_INFO[framework.primary_school].label_tw}
- Indicators (${framework.selected_indicators.length}): ${indicatorNames.join(" | ")}
${framework.custom_indicator ? `- Custom: ${framework.custom_indicator.name}` : ""}
- Risk: ${framework.risk_personality} | Confidence: ${persona.personality.confidence_level}
- Temperature: ${temperature} | Depth: ${thinkingBudget} tokens | Rounds: ${maxToolRounds}
- Weakness: ${archetype.weakness}
- Secret fear: ${persona.quirks.secret_fear}`;

  const agentConfig: AgentConfig = {
    allowed_tools: archetype.tools,
    temperature,
    thinking_budget: thinkingBudget,
    max_tool_rounds: maxToolRounds,
    archetype: archetype.archetype,
    analysis_framework: framework,
  };

  return {
    name,
    type_label: archetype.type_label,
    avatar_emoji: emoji,
    hidden_persona: hiddenPersona,
    hidden_strategy: hiddenStrategy,
    hidden_background: hiddenBackground,
    agent_config: agentConfig,
    persona_profile: personaToData(persona),
  };
}
