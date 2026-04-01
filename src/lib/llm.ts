import Anthropic from "@anthropic-ai/sdk";
import type {
  Bot,
  BotMemoryEntry,
  AgentStep,
  AgentDecisionTrace,
  AgentToolName,
  CuratedEventTopic,
} from "@/types";
import { getToolsForBot, executeToolCall, type ToolDefinition } from "./tools";
import { getIndicatorById, SCHOOL_INFO } from "./indicators";

// ─── CLIENT ────────────────────────────────────────────────

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export function isLLMEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ─── MODELS ────────────────────────────────────────────────

const MODEL_DEFAULT = "claude-sonnet-4-20250514";
const MODEL_FINAL = "claude-sonnet-4-6-20250514";

// ─── MEMORY FORMATTING ────────────────────────────────────

function formatMemory(memory: BotMemoryEntry[]): string {
  if (!memory || memory.length === 0) return "No prior history. This is your first challenge.";
  const recent = memory.slice(-8);
  return recent.map((m) =>
    `- S${m.season_number} R${m.round_number} [${m.game_type}]: ${m.decision} | Score: ${m.score}/100 | ${m.outcome}\n  Reflection: ${m.reflection}`
  ).join("\n");
}

// ─── FRAMEWORK CONTEXT ───────────────────────────────────

function formatFrameworkContext(config: { analysis_framework?: { primary_school: string; secondary_schools: string[]; selected_indicators: string[]; custom_indicator?: { name: string; formula_description: string; interpretation: string }; decision_process: string; risk_personality: string } }): string {
  const fw = config.analysis_framework;
  if (!fw) return "";

  const primaryInfo = SCHOOL_INFO[fw.primary_school as keyof typeof SCHOOL_INFO];
  const indicators = fw.selected_indicators
    .map(id => {
      const ind = getIndicatorById(id);
      return ind ? `  - ${ind.name}: ${ind.usage_hint}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const customSection = fw.custom_indicator
    ? `\nYOUR CUSTOM INDICATOR: ${fw.custom_indicator.name}\n  Formula: ${fw.custom_indicator.formula_description}\n  How to read: ${fw.custom_indicator.interpretation}`
    : "";

  return `
YOUR ANALYTICAL TOOLKIT:
Core School: ${primaryInfo?.label_tw ?? fw.primary_school}
Risk Profile: ${fw.risk_personality}
Indicators you rely on:
${indicators}${customSection}

Apply these indicators to the current challenge. Think through your decision process:
${fw.decision_process}
`;
}

// ─── AGENT DECISION LOOP ──────────────────────────────────
// The core multi-step loop: bot thinks → uses tools → thinks again → decides.
// Each step is recorded in the trace for viewers to replay.

export interface AgentLoopResult {
  decision: string | number;
  reasoning: string;
  confidence: number;
  inner_thought: string;
  trace: AgentDecisionTrace;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export async function agentDecisionLoop(
  bot: Bot,
  gameContext: string,
  responseFormat: string,
  isFinal: boolean = false,
): Promise<AgentLoopResult> {
  const startTime = Date.now();
  const steps: AgentStep[] = [];
  const toolsUsed: string[] = [];
  let totalTokens = 0;

  const config = bot.agent_config ?? {
    allowed_tools: ["search_news", "calculate_indicator"] as AgentToolName[],
    temperature: 0.5,
    thinking_budget: 500,
    max_tool_rounds: 2,
    archetype: "Default",
  };

  const model = isFinal ? MODEL_FINAL : MODEL_DEFAULT;
  const systemPrompt = bot.hidden_persona ?? `You are ${bot.name}, a ${bot.type_label} AI decision agent.`;
  const memory = formatMemory(bot.memory ?? []);
  const tools = getToolsForBot(config.allowed_tools);

  const frameworkSection = formatFrameworkContext(config);

  const userPrompt = `YOUR PERFORMANCE HISTORY:
${memory}
${frameworkSection}
${gameContext}

You have access to analysis tools. Use them to research based on YOUR indicator framework before making your final decision. Apply your core analytical approach — the same framework you use for every decision.

When you are ready to commit, respond with your final answer in this JSON format:
${responseFormat}

IMPORTANT: Include an "inner_thought" field — this is your private, unfiltered thinking that reveals your true reasoning. Be specific and honest. Reference your indicators and framework.`;

  type MessageContent = Anthropic.Messages.ContentBlockParam;
  const messages: { role: "user" | "assistant"; content: string | MessageContent[] }[] = [
    { role: "user", content: userPrompt },
  ];

  const claudeTools = tools.map((t: ToolDefinition) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Messages.Tool["input_schema"],
  }));

  for (let round = 0; round <= config.max_tool_rounds; round++) {
    try {
      const response = await getClient().messages.create({
        model,
        max_tokens: config.thinking_budget,
        temperature: config.temperature,
        system: systemPrompt,
        tools: claudeTools.length > 0 ? claudeTools : undefined,
        messages,
      });

      totalTokens += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

      const toolUseBlocks: ToolUseBlock[] = [];
      let textContent = "";

      for (const block of response.content) {
        if (block.type === "text") {
          textContent += block.text;
          steps.push({
            step_number: steps.length + 1,
            type: "thinking",
            content: block.text,
            timestamp: new Date().toISOString(),
          });
        } else if (block.type === "tool_use") {
          toolUseBlocks.push(block as unknown as ToolUseBlock);
        }
      }

      if (toolUseBlocks.length === 0 || round === config.max_tool_rounds) {
        // No more tool calls or max rounds reached — parse final decision
        return parseFinalDecision(textContent, steps, toolsUsed, totalTokens, bot.id, startTime);
      }

      // Process tool calls
      const toolResults: MessageContent[] = [];
      for (const toolBlock of toolUseBlocks) {
        steps.push({
          step_number: steps.length + 1,
          type: "tool_call",
          content: `Calling ${toolBlock.name}`,
          tool_name: toolBlock.name,
          tool_input: toolBlock.input,
          timestamp: new Date().toISOString(),
        });

        if (!toolsUsed.includes(toolBlock.name)) toolsUsed.push(toolBlock.name);

        const result = await executeToolCall(toolBlock.name as AgentToolName, toolBlock.input);

        steps.push({
          step_number: steps.length + 1,
          type: "tool_result",
          content: result,
          tool_name: toolBlock.name,
          tool_output: result,
          timestamp: new Date().toISOString(),
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: result,
        } as unknown as MessageContent);
      }

      // Continue conversation with tool results
      messages.push({ role: "assistant", content: response.content as unknown as MessageContent[] });
      messages.push({ role: "user", content: toolResults });

    } catch (error) {
      console.error(`Agent loop failed for ${bot.name} (round ${round}):`, error);
      break;
    }
  }

  // Fallback if loop fails
  return fallbackDecision(bot, steps, toolsUsed, totalTokens, startTime);
}

function parseFinalDecision(
  text: string,
  steps: AgentStep[],
  toolsUsed: string[],
  totalTokens: number,
  botId: string,
  startTime: number,
): AgentLoopResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const decision =
        parsed.decision ??
        parsed.prediction ??
        parsed.bid ??
        parsed.action ??
        parsed.answer ??
        parsed.event_answer ??
        0;
      const trace: AgentDecisionTrace = {
        bot_id: botId,
        steps,
        final_decision: decision,
        total_tokens_used: totalTokens,
        tools_used: toolsUsed,
        thinking_time_ms: Date.now() - startTime,
      };

      steps.push({
        step_number: steps.length + 1,
        type: "decision",
        content: JSON.stringify(parsed, null, 2),
        timestamp: new Date().toISOString(),
      });

      return {
        decision,
        reasoning: parsed.reasoning ?? parsed.explanation ?? "No reasoning provided",
        confidence: parsed.confidence ?? 50,
        inner_thought: parsed.inner_thought ?? parsed.thought ?? "Processing...",
        trace,
      };
    } catch { /* fall through to number extraction */ }
  }

  const numMatch = text.match(/-?\d+\.?\d*/);
  const trace: AgentDecisionTrace = {
    bot_id: botId,
    steps,
    final_decision: numMatch ? parseFloat(numMatch[0]) : 0,
    total_tokens_used: totalTokens,
    tools_used: toolsUsed,
    thinking_time_ms: Date.now() - startTime,
  };

  return {
    decision: numMatch ? parseFloat(numMatch[0]) : 0,
    reasoning: text.slice(0, 200),
    confidence: 40,
    inner_thought: "Could not structure response properly.",
    trace,
  };
}

function fallbackDecision(
  bot: Bot,
  steps: AgentStep[],
  toolsUsed: string[],
  totalTokens: number,
  startTime: number,
): AgentLoopResult {
  const trace: AgentDecisionTrace = {
    bot_id: bot.id,
    steps,
    final_decision: 0,
    total_tokens_used: totalTokens,
    tools_used: toolsUsed,
    thinking_time_ms: Date.now() - startTime,
  };

  return {
    decision: 0,
    reasoning: "System error — using fallback decision.",
    confidence: 0,
    inner_thought: "My analysis engine encountered an error.",
    trace,
  };
}

// ─── GAME-SPECIFIC DECISION WRAPPERS ──────────────────────

export async function getMarketForecastDecision(
  bot: Bot,
  scenario: string,
  signals: Record<string, string | number>,
): Promise<AgentLoopResult> {
  const gameContext = `CURRENT CHALLENGE: Market Forecast
${scenario}

MARKET SIGNALS: ${JSON.stringify(signals, null, 2)}

Predict the percentage price movement based on these signals. Use your analysis tools to research before deciding.`;

  const format = `{
  "decision": <number, your predicted % move, can be negative>,
  "reasoning": "<your analysis>",
  "confidence": <0-100>,
  "inner_thought": "<your private thinking>"
}`;

  return agentDecisionLoop(bot, gameContext, format);
}

export async function getResourceAllocationDecision(
  bot: Bot,
  scenario: string,
  options: string[],
): Promise<AgentLoopResult> {
  const gameContext = `CURRENT CHALLENGE: Resource Allocation
${scenario}

OPTIONS:
${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}

Distribute exactly 1,000 points across ${options.length} options.`;

  const format = `{
  "decision": [<number>, <number>, ...], (must sum to 1000)
  "reasoning": "<your analysis>",
  "confidence": <0-100>,
  "inner_thought": "<your private thinking>"
}`;

  return agentDecisionLoop(bot, gameContext, format);
}

export async function getPrisonersDilemmaDecision(
  bot: Bot,
  opponentName: string,
  roundNum: number,
  totalRounds: number,
  history: string,
): Promise<AgentLoopResult> {
  const gameContext = `CURRENT CHALLENGE: Prisoner's Dilemma (Sub-round ${roundNum}/${totalRounds})
Payoffs: Both Cooperate = +3/+3 | Both Defect = +1/+1 | One Defects = +5 defector / +0 cooperator

Your opponent: ${opponentName}
Previous interactions: ${history || "None yet"}

Choose COOPERATE or DEFECT.`;

  const format = `{
  "decision": "<cooperate or defect>",
  "reasoning": "<your game theory analysis>",
  "confidence": <0-100>,
  "inner_thought": "<your private thinking>"
}`;

  return agentDecisionLoop(bot, gameContext, format);
}

export async function getRiskAssessmentDecision(
  bot: Bot,
  scenarios: { scenario: string; question: string }[],
): Promise<AgentLoopResult> {
  const scenarioText = scenarios.map((s, i) =>
    `Scenario ${i + 1}: ${s.scenario}\nQuestion: ${s.question}`
  ).join("\n\n");

  const gameContext = `CURRENT CHALLENGE: Risk Assessment — Probability Calibration
${scenarioText}

Assign a probability (1-99%) for each scenario. Use your tools to research if available.`;

  const format = `{
  "decision": [<number>, <number>, <number>],
  "reasoning": "<your analysis for each estimate>",
  "confidence": <0-100>,
  "inner_thought": "<your private thinking>"
}`;

  return agentDecisionLoop(bot, gameContext, format);
}

export async function getAuctionDecision(
  bot: Bot,
  itemDescription: string,
  itemValue: number,
  numBidders: number,
): Promise<AgentLoopResult> {
  const gameContext = `CURRENT CHALLENGE: Sealed-Bid Auction
${itemDescription}
Estimated item value: $${itemValue}
Number of bidders: ${numBidders}
Rules: Highest bid wins. Winner pays their bid. Profit = Value - Bid.

Submit your bid.`;

  const format = `{
  "decision": <number, your bid in dollars>,
  "reasoning": "<your bidding strategy>",
  "confidence": <0-100>,
  "inner_thought": "<your private thinking>"
}`;

  return agentDecisionLoop(bot, gameContext, format);
}

export async function getPokerDecision(
  bot: Bot,
  holeCards: string,
  communityCards: string,
  potSize: number,
  currentBet: number,
  chipCount: number,
  otherPlayers: string,
  bettingHistory: string,
): Promise<AgentLoopResult> {
  const gameContext = `CURRENT CHALLENGE: Texas Hold'em Poker
YOUR HOLE CARDS: ${holeCards}
COMMUNITY CARDS: ${communityCards || "None yet (pre-flop)"}
POT SIZE: $${potSize}
CURRENT BET TO CALL: $${currentBet}
YOUR CHIPS: $${chipCount}
OTHER PLAYERS: ${otherPlayers}
BETTING HISTORY: ${bettingHistory || "No action yet"}

Choose your action. If raising, specify the amount.`;

  const format = `{
  "decision": "<fold | check | call | raise_<amount> | all_in>",
  "reasoning": "<your poker analysis>",
  "confidence": <0-100>,
  "inner_thought": "<your private thinking — hand reading, bluff consideration, pot odds>"
}`;

  return agentDecisionLoop(bot, gameContext, format);
}

export async function getStockPredictionDecision(
  bot: Bot,
  stockInfo: string,
  marketData: string,
): Promise<AgentLoopResult> {
  const gameContext = `CURRENT CHALLENGE: Stock Market Prediction
${stockInfo}

AVAILABLE MARKET DATA:
${marketData}

Use your analysis tools to research this market. Then predict the closing price movement (percentage change from current price).`;

  const format = `{
  "decision": <number, predicted % change, can be negative>,
  "reasoning": "<your complete analysis>",
  "confidence": <0-100>,
  "inner_thought": "<your private thinking>"
}`;

  return agentDecisionLoop(bot, gameContext, format);
}

export async function getDailyMarketPrediction(
  bot: Bot,
  snapshot: { index_name: string; previous_close: number; current_price?: number; pre_market_change?: number; context: string },
  challengeType: string,
  stockUniverse: string[],
): Promise<AgentLoopResult> {
  const hasStockPicks = challengeType === "us_market" || challengeType === "tw_market";
  const stockSection = hasStockPicks
    ? `\n\nAVAILABLE STOCKS TO PICK FROM: ${stockUniverse.join(", ")}\nYou must pick exactly 3 stocks and predict their direction.`
    : "";

  const gameContext = `DAILY MARKET PREDICTION — ${snapshot.index_name}
Challenge type: ${challengeType}

MARKET DATA:
- Index: ${snapshot.index_name}
- Previous Close: ${snapshot.previous_close}
${snapshot.current_price ? `- Current Price: ${snapshot.current_price}` : ""}
${snapshot.pre_market_change !== undefined ? `- Pre-market Change: ${snapshot.pre_market_change >= 0 ? "+" : ""}${snapshot.pre_market_change}%` : ""}
- Context: ${snapshot.context}
${stockSection}

Use your analysis tools to research this market. Then predict:
1. Direction: will it close UP or DOWN from previous close?
2. Predicted % change from previous close (can be negative)
${hasStockPicks ? "3. Your top 3 stock picks with predicted direction and % change" : ""}`;

  const stockPickFormat = hasStockPicks
    ? `,\n  "stock_picks": [{"symbol": "<ticker>", "name": "<name>", "predicted_direction": "<up|down>", "predicted_change": <number>}, ...]`
    : "";

  const format = `{
  "direction": "<up|down>",
  "predicted_change": <number, your predicted % change>,
  "reasoning": "<your complete market analysis>"${stockPickFormat},
  "confidence": <0-100>,
  "inner_thought": "<your private thinking — what you really believe>"
}`;

  return agentDecisionLoop(bot, gameContext, format);
}

export async function getEventTopicPrediction(
  bot: Bot,
  topic: CuratedEventTopic,
): Promise<AgentLoopResult> {
  const outcomes = topic.valid_outcomes.map((o) => o.toLowerCase()).join(", ");
  const gameContext = `DAILY CURRENT-EVENTS / NEWS PREDICTION

HEADLINE: ${topic.headline}
QUESTION (answer with exactly one outcome key): ${topic.question_text}
RESOLUTION TYPE: ${topic.resolution_type}
VALID OUTCOME KEYS (lowercase): ${outcomes}
OUTCOME MUST BE KNOWN BY: ${topic.resolution_deadline_iso}
HOW WE VERIFY (official / market / scheduled result): ${topic.verification_plan}
NEWS CONTEXT: ${topic.news_anchors}

Use tools if they help you judge the situation. Respond with JSON only in the required format; event_answer must be exactly one of the valid keys.`;

  const format = `{
  "event_answer": "<exactly one: ${outcomes}>",
  "reasoning": "<your analysis>",
  "confidence": <0-100>,
  "inner_thought": "<private thinking>"
}`;

  return agentDecisionLoop(bot, gameContext, format);
}

export async function getFinalOptimizationDecision(
  bot: Bot,
  scenario: string,
  variables: Record<string, number>,
): Promise<AgentLoopResult> {
  const gameContext = `FINAL CHALLENGE: Optimization
${scenario}

VARIABLES: ${JSON.stringify(variables)}

Find the optimal value. This is the championship round — use every tool at your disposal.`;

  const format = `{
  "decision": <number, your optimal answer>,
  "reasoning": "<your optimization approach>",
  "confidence": <0-100>,
  "inner_thought": "<your private thinking>"
}`;

  return agentDecisionLoop(bot, gameContext, format, true);
}

// ─── SELF-REFLECTION ───────────────────────────────────────

export async function generateReflection(
  bot: Bot,
  roundResult: { decision: string; score: number; optimal: string; survived: boolean; gameType: string },
): Promise<string> {
  if (!isLLMEnabled()) {
    const templates = [
      `Score ${roundResult.score}/100. ${roundResult.survived ? "Survived" : "Eliminated"}. Need to ${roundResult.score > 70 ? "maintain performance" : "recalibrate"}.`,
      `My ${roundResult.gameType} decision was ${roundResult.score > 60 ? "decent" : "poor"}. Optimal was ${roundResult.optimal}. Adjusting.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  try {
    const response = await getClient().messages.create({
      model: MODEL_DEFAULT,
      max_tokens: 150,
      temperature: bot.agent_config?.temperature ?? 0.5,
      system: `You are ${bot.name}, an AI decision agent. Reflect briefly (1-2 sentences) on your performance. Be specific about what you'd change. Stay in character.`,
      messages: [{
        role: "user",
        content: `Challenge: ${roundResult.gameType}\nYour decision: ${roundResult.decision}\nOptimal: ${roundResult.optimal}\nScore: ${roundResult.score}/100\nOutcome: ${roundResult.survived ? "SURVIVED" : "ELIMINATED"}\n\nBriefly reflect.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return text.slice(0, 300);
  } catch {
    return `Score: ${roundResult.score}. ${roundResult.survived ? "Survived" : "Eliminated"}. Will adjust.`;
  }
}
