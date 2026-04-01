import type { AgentToolName } from "@/types";
import { fetchInternationalNews, getNewsProviderMode } from "./news-client";
import type { NewsArticle } from "./news-client";
import {
  fetchPolymarketBriefsForTopic,
  fetchPolymarketIntel,
  getIntelSourceMode,
  type PolymarketMarketBrief,
} from "./prediction-markets";

// ─── TOOL DEFINITIONS (Claude API format) ──────────────────

export interface ToolDefinition {
  name: AgentToolName;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

export const ALL_TOOLS: ToolDefinition[] = [
  {
    name: "search_news",
    description:
      "Discovery for timely topics: by default pulls open Polymarket prediction markets (high-liquidity, near-term resolution) via public API; optional hybrid adds NewsAPI/GNews if configured. Use for macro, geopolitics, elections, crypto, sports-adjacent outcomes. Returns ranked markets with implied odds and links.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "News search query (e.g. 'Fed rate decision', 'NVIDIA earnings', 'TSMC revenue guidance')" },
        category: { type: "string", description: "Focus area", enum: ["general", "earnings", "macro", "geopolitics", "sector", "regulatory"] },
      },
      required: ["query"],
    },
  },
  {
    name: "calculate_indicator",
    description: "Calculate a technical, institutional, or macro indicator for a market/asset. Supports RSI, MACD, Bollinger, KD, MA crossover, Volume Profile, Fibonacci, Ichimoku, ATR, Support/Resistance, foreign flow, put/call ratio, margin data, VIX, yield curve, and more.",
    input_schema: {
      type: "object",
      properties: {
        indicator: {
          type: "string",
          description: "Indicator to calculate",
          enum: [
            "RSI", "MACD", "Bollinger", "KD", "MA_Cross", "Volume_Profile",
            "Fibonacci", "Ichimoku", "ATR", "Support_Resistance", "Candlestick",
            "Divergence",
            "Foreign_Flow", "Dealer_Position", "Margin_Trading", "Put_Call_Ratio",
            "Dark_Pool", "Fund_Flow", "Insider_Trading",
            "VIX", "Yield_Curve", "Dollar_Index", "PMI", "Money_Supply",
            "Sector_Rotation", "Fear_Greed",
          ],
        },
        symbol: { type: "string", description: "Asset/market symbol (e.g. 'SPY', 'TAIEX', '2330.TW', 'BTC')" },
        period: { type: "string", description: "Time period (e.g. '14', '50', '200')" },
      },
      required: ["indicator", "symbol"],
    },
  },
  {
    name: "analyze_sentiment",
    description:
      "Sentiment / crowd belief: default uses matched Polymarket implied probabilities (market odds); optional hybrid adds news keyword skim. Not investment advice.",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Market/sector/asset to analyze sentiment for" },
        depth: { type: "string", description: "Analysis depth", enum: ["quick", "detailed"] },
      },
      required: ["topic"],
    },
  },
  {
    name: "get_historical_pattern",
    description: "Find the 3 closest historical pattern matches for a given scenario. Returns dates, conditions, outcomes, and statistical confidence.",
    input_schema: {
      type: "object",
      properties: {
        scenario: { type: "string", description: "Current market scenario description" },
        timeframe: { type: "string", description: "Outcome timeframe (e.g. '1 day', '1 week', '1 month')" },
      },
      required: ["scenario"],
    },
  },
  {
    name: "calculate_probability",
    description: "Calculate probability of an event using Bayesian updating from base rates with factor-specific adjustments.",
    input_schema: {
      type: "object",
      properties: {
        event: { type: "string", description: "Event to calculate probability for" },
        factors: { type: "string", description: "Comma-separated factors to consider" },
      },
      required: ["event"],
    },
  },
];

export function getToolsForBot(allowedTools: AgentToolName[]): ToolDefinition[] {
  return ALL_TOOLS.filter((t) => allowedTools.includes(t.name));
}

// ─── SEEDED RANDOM HELPERS ─────────────────────────────────

function pickSeeded<T>(arr: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(hash) % arr.length];
}

function numSeeded(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  const norm = (Math.abs(hash) % 10000) / 10000;
  return Math.round((min + norm * (max - min)) * 10) / 10;
}

function boolSeeded(seed: string, threshold: number = 0.5): boolean {
  return numSeeded(seed, 0, 1) >= threshold;
}

// ─── TOOL DISPATCHER ───────────────────────────────────────

export function simulateToolCall(toolName: AgentToolName, input: Record<string, unknown>): string {
  switch (toolName) {
    case "search_news": return simulateSearchNews(String(input.query ?? ""), String(input.category ?? "general"));
    case "calculate_indicator": return simulateCalculateIndicator(String(input.indicator ?? "RSI"), String(input.symbol ?? "SPY"), String(input.period ?? "14"));
    case "analyze_sentiment": return simulateAnalyzeSentiment(String(input.topic ?? "market"), String(input.depth ?? "quick"));
    case "get_historical_pattern": return simulateHistoricalPattern(String(input.scenario ?? ""), String(input.timeframe ?? "1 month"));
    case "calculate_probability": return simulateCalculateProbability(String(input.event ?? ""), String(input.factors ?? ""));
    default: return "Tool not found.";
  }
}

/** Async: Polymarket Gamma (default) and/or News APIs per BOTCLUB_INTEL_SOURCE; otherwise simulateToolCall. */
export async function executeToolCall(toolName: AgentToolName, input: Record<string, unknown>): Promise<string> {
  switch (toolName) {
    case "search_news":
      return runSearchNewsLive(String(input.query ?? ""), String(input.category ?? "general"));
    case "analyze_sentiment":
      return runAnalyzeSentimentLive(String(input.topic ?? "market"), String(input.depth ?? "quick"));
    default:
      return simulateToolCall(toolName, input);
  }
}

// ─── SEARCH NEWS ───────────────────────────────────────────

const NEWS_SOURCES = ["Reuters", "Bloomberg", "CNBC", "WSJ", "Financial Times", "MarketWatch", "Nikkei Asia", "经济日报"];

function getCategoryNewsContext(category: string, query: string): string {
  const catContext: Record<string, string> = {
    earnings: `\nEarnings context: Next reporting window in 2-3 weeks. Street expectations: ${boolSeeded(query + "beat", 0.6) ? "beatable (lowered bar)" : "stretched (high bar)"}.`,
    macro: `\nMacro backdrop: ${boolSeeded(query + "macro") ? "Easing cycle in progress. Liquidity conditions improving." : "Tightening bias. Dollar strengthening. Risk appetite declining."}`,
    geopolitics: `\nGeopolitical risk: ${boolSeeded(query + "geo") ? "Tensions elevated but contained. Markets pricing in risk premium." : "De-escalation signals. Risk premium declining."}`,
    sector: `\nSector rotation: ${boolSeeded(query + "rot") ? "Money rotating INTO this sector from defensive positions." : "Money rotating OUT toward safer sectors."}`,
    regulatory: `\nRegulatory outlook: ${boolSeeded(query + "reg") ? "Favorable — deregulation trend continues." : "Headwinds — new rules expected within 60 days."}`,
    general: "",
  };
  return catContext[category] ?? "";
}

function formatLiveNewsForTool(
  articles: NewsArticle[],
  query: string,
  category: string,
  provider: string,
): string {
  const lines = articles.map((a, i) => {
    const when = a.publishedAt || "—";
    const desc = a.description ? ` — ${a.description.slice(0, 140)}${a.description.length > 140 ? "…" : ""}` : "";
    return `${i + 1}. [${a.source}] ${a.title} (${when})${desc}`;
  });
  const toneHint =
    articles.length >= 3
      ? "Review headlines for directional bias vs your framework."
      : "Limited articles — corroborate with other tools if needed.";
  return `Live international news (${provider}) for "${query}" (${articles.length} articles):\n${lines.join("\n")}\n\n${toneHint}${getCategoryNewsContext(category, query)}`;
}

function formatPolymarketSentiment(topic: string, depth: string, briefs: PolymarketMarketBrief[]): string {
  const lines = briefs.map((b, i) => {
    const p = b.yesPrice !== undefined ? (b.yesPrice * 100).toFixed(1) : "?";
    const end = new Date(b.endMs).toISOString().slice(0, 10);
    const vol = b.volume >= 1000 ? `${(b.volume / 1000).toFixed(1)}k` : String(Math.round(b.volume));
    return `${i + 1}. P(Yes)≈${p}% · ${b.question}\n   (${end}, ~$${vol} volume) · ${b.url}`;
  });
  let out = `Crowd-implied odds (Polymarket, matched "${topic}"):\n\n${lines.join("\n\n")}\n\nPrices reflect trader belief, not ground truth.`;
  if (depth === "detailed") {
    out += "\n\nOpen links for full resolution criteria and order book.";
  }
  return out;
}

async function runSearchNewsLive(query: string, category: string): Promise<string> {
  const mode = getIntelSourceMode();
  const extra = getCategoryNewsContext(category, query);

  if (mode === "simulate") {
    return simulateSearchNews(query, category);
  }

  if (mode === "polymarket") {
    const p = await fetchPolymarketIntel(query);
    if (p.text && !p.error) return `${p.text}${extra}`;
    if (p.error) {
      return `[Polymarket Gamma] ${p.error}\n\n--- Simulated fallback ---\n${simulateSearchNews(query, category)}`;
    }
    return simulateSearchNews(query, category);
  }

  if (mode === "polymarket_news") {
    const parts: string[] = [];
    const p = await fetchPolymarketIntel(query);
    if (p.error) parts.push(`[Polymarket Gamma] ${p.error}`);
    else if (p.text) parts.push(p.text);
    if (getNewsProviderMode() !== "simulate") {
      const r = await fetchInternationalNews(query);
      if (r.articles.length > 0) {
        parts.push(formatLiveNewsForTool(r.articles, query, category, r.provider));
      } else if (r.error) {
        parts.push(`[News APIs · ${r.provider}] ${r.error}`);
      }
    }
    if (parts.length === 0) return simulateSearchNews(query, category);
    return `${parts.join("\n\n---\n\n")}${extra}`;
  }

  if (mode === "news") {
    if (getNewsProviderMode() === "simulate") {
      return simulateSearchNews(query, category);
    }
    const r = await fetchInternationalNews(query);
    if (r.articles.length > 0) {
      return `${formatLiveNewsForTool(r.articles, query, category, r.provider)}${extra}`;
    }
    if (r.error) {
      return `[Live news · ${r.provider}] ${r.error}\n\n--- Simulated fallback ---\n${simulateSearchNews(query, category)}`;
    }
    return simulateSearchNews(query, category);
  }

  return simulateSearchNews(query, category);
}

function skimSentimentFromHeadlines(articles: NewsArticle[]): { pos: number; neg: number; label: string } {
  const blob = articles.map((a) => `${a.title} ${a.description ?? ""}`).join(" ");
  const pos = (blob.match(/\b(rally|surge|soar|gain|beat|growth|record|high|win|deal|peace|ease|cut\s+rates|bull)\b/gi) ?? []).length;
  const neg = (blob.match(/\b(crash|plunge|slump|fear|war|miss|recession|sanction|downgrade|invasion|terror|bear|default)\b/gi) ?? []).length;
  let label = "mixed / scan headlines";
  if (pos + neg >= 4) {
    if (pos > neg * 1.3) label = "headline skew: somewhat positive";
    else if (neg > pos * 1.3) label = "headline skew: somewhat negative";
  }
  return { pos, neg, label };
}

function formatSentimentFromLiveNews(
  articles: NewsArticle[],
  topic: string,
  depth: string,
  provider: string,
): string {
  const { pos, neg, label } = skimSentimentFromHeadlines(articles);
  const sample = articles.slice(0, 5).map((a, i) => `${i + 1}. [${a.source}] ${a.title}`).join("\n");
  let block = `Live sentiment skim (${provider}) — topic "${topic}" from ${articles.length} recent articles:
- Keyword hits (rough): positive-ish ${pos}, negative-ish ${neg}
- ${label}

Sample headlines:
${sample}

Note: Heuristic only; not a formal sentiment model.`;
  if (depth === "detailed") {
    block += `\n\n--- DETAILED ---\nUse search_news with narrower queries for subtopics. Cross-check multiple languages via BOTCLUB_NEWS_LANGUAGES if configured.`;
  }
  return block;
}

async function runAnalyzeSentimentLive(topic: string, depth: string): Promise<string> {
  const mode = getIntelSourceMode();

  if (mode === "simulate") {
    return simulateAnalyzeSentiment(topic, depth);
  }

  if (mode === "polymarket" || mode === "polymarket_news") {
    const briefs = await fetchPolymarketBriefsForTopic(topic);
    let polyBlock =
      briefs.length > 0
        ? formatPolymarketSentiment(topic, depth, briefs)
        : `Polymarket: no open markets matched "${topic}" in the configured resolve window — try a broader topic or widen BOTCLUB_POLYMARKET_MAX_RESOLVE_DAYS.`;

    if (mode === "polymarket_news" && getNewsProviderMode() !== "simulate") {
      const r = await fetchInternationalNews(topic);
      if (r.articles.length > 0) {
        return `${polyBlock}\n\n---\n\n${formatSentimentFromLiveNews(r.articles, topic, depth, r.provider)}`;
      }
      if (r.error) {
        return `${polyBlock}\n\n[News APIs] ${r.error}`;
      }
    }

    if (mode === "polymarket" && briefs.length === 0) {
      return simulateAnalyzeSentiment(topic, depth);
    }
    return polyBlock;
  }

  if (getNewsProviderMode() === "simulate") {
    return simulateAnalyzeSentiment(topic, depth);
  }
  const r = await fetchInternationalNews(topic);
  if (r.articles.length > 0) {
    return formatSentimentFromLiveNews(r.articles, topic, depth, r.provider);
  }
  if (r.error) {
    return `[Live news · ${r.provider}] ${r.error}\n\n--- Simulated fallback ---\n${simulateAnalyzeSentiment(topic, depth)}`;
  }
  return simulateAnalyzeSentiment(topic, depth);
}

function simulateSearchNews(query: string, category: string): string {
  const q = query.toLowerCase();
  const bullish = ["growth", "rally", "surge", "approve", "upgrade", "beat", "strong", "record", "breakthrough"].some(w => q.includes(w));
  const bearish = ["crash", "decline", "recession", "downgrade", "miss", "weak", "fear", "warning", "cut"].some(w => q.includes(w));
  const tone = bullish ? "positive" : bearish ? "negative" : "mixed";

  const headlines: Record<string, string[][]> = {
    positive: [
      [`Analysts upgrade outlook on "${query}" citing improving fundamentals and strong forward guidance`, `Markets respond favorably — institutional buyers increase exposure to ${query} sector`, `Surprise positive data: ${query} beats consensus by 12%, triggering upward revisions`, `Fund managers surveyed: 73% now overweight on ${query} theme`],
    ],
    negative: [
      [`Concerns mount as ${query} indicators deteriorate below key thresholds`, `Institutional investors cut exposure to ${query}: net outflow $1.4B this week`, `Warning signs multiply in ${query} — risk premiums at 18-month highs`, `Consensus downgrade: ${query} outlook shifts from "neutral" to "underweight"`],
    ],
    mixed: [
      [`"${query}" shows divergent signals — macro data conflicts with micro trends`, `Debate intensifies: ${query} bulls point to resilience, bears cite structural headwinds`, `${query} sector rotates internally: winners and losers emerging within the theme`, `Consensus splits: 48% bullish, 38% bearish, 14% neutral on ${query}`],
    ],
  };

  const h = headlines[tone]![0];
  const srcs = [0, 1, 2, 3].map(i => pickSeeded(NEWS_SOURCES, query + "s" + i));
  const times = ["8 min ago", "32 min ago", "1 hour ago", "3 hours ago"];

  return `Recent News for "${query}":\n${h.map((line, i) => `${i + 1}. [${srcs[i]}] ${line} (${times[i]})`).join("\n")}\n\nOverall tone: ${tone}. Relevance: high.${getCategoryNewsContext(category, query)}`;
}

// ─── CALCULATE INDICATOR ───────────────────────────────────

function simulateCalculateIndicator(indicator: string, symbol: string, period: string): string {
  const seed = `${indicator}-${symbol}-${period}`;
  const ind = indicator.toUpperCase().replace(/ /g, "_");

  switch (ind) {
    case "RSI": {
      const val = numSeeded(seed, 25, 82);
      const zone = val > 70 ? "OVERBOUGHT" : val < 30 ? "OVERSOLD" : "NEUTRAL";
      return `RSI(${period}) for ${symbol}: ${val}\nZone: ${zone}\nInterpretation: ${val > 50 ? "Bullish momentum" : "Bearish momentum"}. Previous peak: ${numSeeded(seed + "p", 55, 85)} (${numSeeded(seed + "d", 5, 30).toFixed(0)} sessions ago). Divergence: ${val > 65 ? "bearish divergence forming" : "no divergence"}.`;
    }
    case "MACD": {
      const macd = numSeeded(seed, -3, 5);
      const signal = numSeeded(seed + "sig", -2, 4);
      const hist = Math.round((macd - signal) * 100) / 100;
      return `MACD for ${symbol}:\nMACD: ${macd} | Signal: ${signal} | Histogram: ${hist}\n${hist > 0 ? "BULLISH crossover" : "BEARISH crossover"}. Histogram ${Math.abs(hist) > 1 ? "widening — strong momentum" : "narrowing — momentum fading"}.`;
    }
    case "BOLLINGER": {
      const mid = numSeeded(seed, 100, 500);
      const w = numSeeded(seed + "w", 5, 20);
      const price = mid + numSeeded(seed + "p", -w, w);
      const pctB = ((price - (mid - w)) / (2 * w) * 100).toFixed(1);
      return `Bollinger(${period}) for ${symbol}:\nUpper: $${(mid + w).toFixed(2)} | Mid: $${mid.toFixed(2)} | Lower: $${(mid - w).toFixed(2)}\nPrice: $${price.toFixed(2)} | %B: ${pctB}%\nBand Width: ${(w * 2 / mid * 100).toFixed(1)}% — ${w * 2 / mid > 0.1 ? "high volatility" : "squeeze forming (breakout likely)"}.`;
    }
    case "KD": {
      const k = numSeeded(seed, 15, 90);
      const d = numSeeded(seed + "d", 20, 85);
      return `KD Stochastic for ${symbol}:\n%K: ${k.toFixed(1)} | %D: ${d.toFixed(1)}\n${k > d ? "K above D → BULLISH signal" : "K below D → BEARISH signal"}. ${k > 80 ? "OVERBOUGHT zone" : k < 20 ? "OVERSOLD zone" : "Neutral zone"}.`;
    }
    case "MA_CROSS": {
      const sma50 = numSeeded(seed + "50", 100, 500);
      const sma200 = numSeeded(seed + "200", 95, 490);
      const golden = sma50 > sma200;
      return `MA Cross for ${symbol}:\nSMA(50): $${sma50.toFixed(2)} | SMA(200): $${sma200.toFixed(2)}\n${golden ? "🟢 GOLDEN CROSS — 50MA above 200MA. Bullish trend confirmed." : "🔴 DEATH CROSS — 50MA below 200MA. Bearish trend confirmed."}\nSpread: ${Math.abs(sma50 - sma200).toFixed(2)} (${(Math.abs(sma50 - sma200) / sma200 * 100).toFixed(1)}%).`;
    }
    case "VOLUME_PROFILE": {
      const poc = numSeeded(seed, 100, 500);
      const valHigh = poc + numSeeded(seed + "h", 5, 20);
      const valLow = poc - numSeeded(seed + "l", 5, 20);
      return `Volume Profile for ${symbol}:\nPOC (Point of Control): $${poc.toFixed(2)}\nValue Area High: $${valHigh.toFixed(2)} | Value Area Low: $${valLow.toFixed(2)}\n${boolSeeded(seed + "above") ? "Price ABOVE value area — bullish breakout" : "Price within value area — range-bound"}.\nHigh volume nodes at $${poc.toFixed(2)} = strong support.`;
    }
    case "FIBONACCI": {
      const high = numSeeded(seed + "h", 200, 600);
      const low = numSeeded(seed + "l", 100, high * 0.8);
      const range = high - low;
      const levels = [0.236, 0.382, 0.5, 0.618, 0.786].map(r => (high - range * r).toFixed(2));
      return `Fibonacci Retracement for ${symbol}:\nSwing High: $${high.toFixed(2)} | Swing Low: $${low.toFixed(2)}\n23.6%: $${levels[0]} | 38.2%: $${levels[1]} | 50.0%: $${levels[2]} | 61.8%: $${levels[3]} | 78.6%: $${levels[4]}\nKey level: 61.8% ($${levels[3]}) — golden ratio. ${boolSeeded(seed + "hold") ? "Price holding above 61.8% → trend intact" : "Price approaching 61.8% → critical test"}.`;
    }
    case "ICHIMOKU": {
      const tenkan = numSeeded(seed + "t", 100, 500);
      const kijun = numSeeded(seed + "k", 95, 495);
      const cloudTop = numSeeded(seed + "ct", 98, 498);
      const cloudBot = numSeeded(seed + "cb", 90, 490);
      return `Ichimoku Cloud for ${symbol}:\nTenkan-sen: $${tenkan.toFixed(2)} | Kijun-sen: $${kijun.toFixed(2)}\nCloud: $${cloudTop.toFixed(2)} — $${cloudBot.toFixed(2)}\n${tenkan > kijun ? "TK Cross BULLISH" : "TK Cross BEARISH"}. ${tenkan > cloudTop ? "Price ABOVE cloud — strong bullish" : tenkan > cloudBot ? "Price IN cloud — indecision" : "Price BELOW cloud — bearish"}.`;
    }
    case "ATR": {
      const atr = numSeeded(seed, 1, 15);
      return `ATR(${period}) for ${symbol}: $${atr.toFixed(2)}\nVolatility: ${atr > 8 ? "HIGH" : atr > 4 ? "MODERATE" : "LOW"}. Suggested stop: ${(atr * 2).toFixed(2)} ($2×ATR). Position sizing: risk ${(100 / atr).toFixed(1)}% per ATR.`;
    }
    case "SUPPORT_RESISTANCE": {
      const price = numSeeded(seed, 100, 500);
      const r1 = price + numSeeded(seed + "r1", 3, 15);
      const r2 = price + numSeeded(seed + "r2", 15, 30);
      const s1 = price - numSeeded(seed + "s1", 3, 15);
      const s2 = price - numSeeded(seed + "s2", 15, 30);
      return `Support/Resistance for ${symbol}:\nR2: $${r2.toFixed(2)} (strong) | R1: $${r1.toFixed(2)} (near)\nCurrent: ~$${price.toFixed(2)}\nS1: $${s1.toFixed(2)} (near) | S2: $${s2.toFixed(2)} (strong)\n${boolSeeded(seed + "test") ? "Testing resistance R1 — breakout watch" : "Holding above support S1 — base building"}.`;
    }
    case "CANDLESTICK": {
      const patterns = ["Bullish Engulfing", "Bearish Engulfing", "Doji", "Hammer", "Shooting Star", "Morning Star", "Evening Star", "Three White Soldiers", "Three Black Crows"];
      const pattern = pickSeeded(patterns, seed);
      const bullish = ["Bullish Engulfing", "Hammer", "Morning Star", "Three White Soldiers"].includes(pattern);
      return `Candlestick Pattern for ${symbol}:\nDetected: ${pattern}\nSignal: ${bullish ? "BULLISH reversal/continuation" : "BEARISH reversal/continuation"}\nReliability: ${numSeeded(seed + "rel", 55, 85).toFixed(0)}%\nConfirmation: ${boolSeeded(seed + "conf") ? "Confirmed by volume spike" : "Awaiting volume confirmation"}.`;
    }
    case "DIVERGENCE": {
      const hasDivergence = boolSeeded(seed, 0.4);
      if (!hasDivergence) return `Divergence Analysis for ${symbol}: No significant divergence detected. Price and momentum indicators aligned.`;
      const type = boolSeeded(seed + "type") ? "BEARISH" : "BULLISH";
      return `Divergence Analysis for ${symbol}:\n⚠️ ${type} DIVERGENCE detected!\n${type === "BEARISH" ? "Price making higher highs but RSI making lower highs" : "Price making lower lows but RSI making higher lows"}\nStrength: ${pickSeeded(["weak", "moderate", "strong"], seed + "str")}\nHistorical success rate: ${numSeeded(seed + "sr", 55, 80).toFixed(0)}%.`;
    }
    case "FOREIGN_FLOW": {
      const netFlow = numSeeded(seed, -500, 800);
      const days = numSeeded(seed + "d", 1, 15).toFixed(0);
      return `Foreign Investor Flow for ${symbol}:\nNet flow: ${netFlow > 0 ? "+" : ""}$${netFlow.toFixed(0)}M today\nConsecutive ${netFlow > 0 ? "buy" : "sell"} days: ${days}\nMonthly cumulative: ${netFlow > 0 ? "+" : ""}$${(netFlow * parseFloat(days) * 0.8).toFixed(0)}M\nSignal: ${Math.abs(netFlow) > 300 ? "STRONG " : ""}${netFlow > 0 ? "institutional accumulation" : "institutional distribution"}.`;
    }
    case "DEALER_POSITION": {
      const net = numSeeded(seed, -2000, 3000);
      const hedging = numSeeded(seed + "h", 30, 90);
      return `Dealer/Market Maker Position for ${symbol}:\nNet position: ${net > 0 ? "+" : ""}${net.toFixed(0)} contracts\nHedging ratio: ${hedging.toFixed(0)}%\n${net > 0 ? "Dealers NET LONG — expect support at current levels" : "Dealers NET SHORT — downside pressure likely"}. Hedging ${hedging > 70 ? "heavy — risk-averse stance" : "light — directional bet"}.`;
    }
    case "MARGIN_TRADING": {
      const balance = numSeeded(seed, 5000, 25000);
      const change = numSeeded(seed + "c", -8, 12);
      const util = numSeeded(seed + "u", 30, 75);
      return `Margin Trading Balance for ${symbol}:\nBalance: $${balance.toFixed(0)}M (${change > 0 ? "+" : ""}${change.toFixed(1)}% WoW)\nUtilization: ${util.toFixed(0)}%\n${change > 5 ? "⚠️ Rapid margin increase — leveraged bullish bets building. Margin call risk if reversal." : change < -3 ? "Margin deleveraging in progress — forced selling possible." : "Margin stable — no extreme."} ${util > 60 ? "High utilization = crowded trade." : ""}`;
    }
    case "PUT_CALL_RATIO": {
      const pc = numSeeded(seed, 0.4, 1.5);
      const percentile = numSeeded(seed + "p", 10, 95);
      return `Put/Call Ratio for ${symbol}: ${pc.toFixed(2)}\nPercentile rank (1yr): ${percentile.toFixed(0)}th\n${pc > 1.2 ? "HIGH — extreme fear → contrarian BULLISH signal" : pc < 0.6 ? "LOW — extreme complacency → contrarian BEARISH warning" : "NEUTRAL — no extreme positioning"}.`;
    }
    case "DARK_POOL": {
      const darkPct = numSeeded(seed, 25, 55);
      const unusual = boolSeeded(seed + "u", 0.3);
      return `Dark Pool Activity for ${symbol}:\nDark pool volume: ${darkPct.toFixed(0)}% of total\n${unusual ? "⚠️ UNUSUAL dark pool activity detected! ${numSeeded(seed + 'v', 150, 300).toFixed(0)}% of normal volume. Large institutional positioning in progress." : "Dark pool activity within normal range. No unusual signals."}\nImplication: ${darkPct > 45 ? "Heavy institutional activity — big players positioning" : "Normal retail/institutional mix"}.`;
    }
    case "FUND_FLOW": {
      const weeklyFlow = numSeeded(seed, -3000, 5000);
      const trend = boolSeeded(seed + "t") ? "accelerating" : "decelerating";
      return `ETF/Fund Flow for ${symbol} sector:\nWeekly net flow: ${weeklyFlow > 0 ? "+" : ""}$${weeklyFlow.toFixed(0)}M\nTrend: ${trend}\n4-week total: ${weeklyFlow > 0 ? "+" : ""}$${(weeklyFlow * 3.2).toFixed(0)}M\n${weeklyFlow > 2000 ? "Strong institutional allocation" : weeklyFlow < -1000 ? "Institutional redemption pressure" : "Moderate flows — no extreme"}.`;
    }
    case "INSIDER_TRADING": {
      const netInsider = numSeeded(seed, -5, 8);
      const cluster = boolSeeded(seed + "c", 0.3);
      return `Insider Transactions for ${symbol}:\nNet insider activity (30d): ${netInsider > 0 ? `${netInsider.toFixed(0)} buys` : `${Math.abs(netInsider).toFixed(0)} sells`}\n${cluster ? "⚠️ CLUSTER detected: 3+ insiders buying within 2 weeks — historically strong bullish signal" : "No cluster pattern"}.\nInsider buy/sell ratio: ${numSeeded(seed + "r", 0.3, 2.5).toFixed(1)}.`;
    }
    case "VIX": {
      const vix = numSeeded(seed, 11, 45);
      const term = boolSeeded(seed + "ts") ? "contango (normal)" : "backwardation (stressed)";
      return `VIX for market:\nLevel: ${vix.toFixed(1)}\nPercentile: ${numSeeded(seed + "p", 10, 95).toFixed(0)}th\nTerm structure: ${term}\n${vix > 30 ? "🔴 EXTREME FEAR — historically a buying opportunity. Markets in panic mode." : vix > 20 ? "Elevated uncertainty. Hedging activity increasing." : vix < 15 ? "🟢 Very low volatility — complacency warning. Breakout risk." : "Normal range."}.`;
    }
    case "YIELD_CURVE": {
      const spread = numSeeded(seed, -0.8, 2.5);
      return `Yield Curve (2Y-10Y Spread):\nSpread: ${spread > 0 ? "+" : ""}${spread.toFixed(2)}%\n${spread < 0 ? "🔴 INVERTED — recession signal. Historical lead time: 6-18 months. Probability of recession within 12m: ~65%." : spread < 0.3 ? "Flattening — late cycle. Growth concerns building." : "Normal upward slope — economic expansion consistent."}\n10Y yield: ${numSeeded(seed + "10", 3.5, 5.0).toFixed(2)}% | 2Y yield: ${numSeeded(seed + "2", 3.8, 5.5).toFixed(2)}%.`;
    }
    case "DOLLAR_INDEX": {
      const dxy = numSeeded(seed, 95, 110);
      const trend = boolSeeded(seed + "t") ? "strengthening" : "weakening";
      return `US Dollar Index (DXY): ${dxy.toFixed(1)}\nTrend: ${trend}\n${dxy > 105 ? "Strong dollar — headwind for commodities, EM stocks, US multinationals" : dxy < 100 ? "Weak dollar — tailwind for commodities, EM, risk assets" : "Neutral range"}.`;
    }
    case "PMI": {
      const mfg = numSeeded(seed, 42, 58);
      const svc = numSeeded(seed + "s", 45, 60);
      return `PMI Data:\nManufacturing: ${mfg.toFixed(1)} ${mfg > 50 ? "(expansion)" : "(contraction)"}\nServices: ${svc.toFixed(1)} ${svc > 50 ? "(expansion)" : "(contraction)"}\n${mfg > 50 && svc > 50 ? "Broad expansion — risk-on" : mfg < 50 && svc < 50 ? "Broad contraction — recession risk" : "Mixed — sector rotation likely"}.`;
    }
    case "MONEY_SUPPLY": {
      const m2Growth = numSeeded(seed, -3, 8);
      return `Money Supply (M2) YoY Growth: ${m2Growth > 0 ? "+" : ""}${m2Growth.toFixed(1)}%\n${m2Growth > 5 ? "Liquidity expansion — tailwind for asset prices. Inflation risk." : m2Growth < 0 ? "Liquidity contraction — headwind. Historical bear market correlator." : "Moderate growth — neutral for markets."}.`;
    }
    case "SECTOR_ROTATION": {
      const phases = ["Early Cycle", "Mid Cycle", "Late Cycle", "Recession"];
      const phase = pickSeeded(phases, seed);
      const recs: Record<string, string> = {
        "Early Cycle": "Favor: Cyclicals, Small-caps, Financials. Avoid: Utilities, Staples.",
        "Mid Cycle": "Favor: Tech, Industrials, Materials. Avoid: Defensive sectors.",
        "Late Cycle": "Favor: Energy, Healthcare, Staples. Avoid: Discretionary, Small-caps.",
        "Recession": "Favor: Utilities, Healthcare, Gold. Avoid: Cyclicals, Financials.",
      };
      return `Sector Rotation Model:\nCurrent Phase: ${phase}\n${recs[phase]}\nPhase confidence: ${numSeeded(seed + "c", 55, 85).toFixed(0)}%\nEstimated phase duration remaining: ${numSeeded(seed + "dur", 2, 12).toFixed(0)} months.`;
    }
    case "FEAR_GREED": {
      const fg = numSeeded(seed, 10, 95);
      const label = fg > 75 ? "Extreme Greed" : fg > 55 ? "Greed" : fg > 45 ? "Neutral" : fg > 25 ? "Fear" : "Extreme Fear";
      return `Fear & Greed Index: ${fg.toFixed(0)} (${label})\nComponents: Momentum ${numSeeded(seed + "m", 20, 90).toFixed(0)} | Volume ${numSeeded(seed + "v", 20, 90).toFixed(0)} | Put/Call ${numSeeded(seed + "pc", 20, 90).toFixed(0)} | Safe Haven ${numSeeded(seed + "sh", 20, 90).toFixed(0)}\n${fg > 75 || fg < 25 ? "⚠️ EXTREME reading — contrarian signal. Historical reversal probability: ~68%." : "No extreme — trend continuation likely."}.`;
    }
    default: {
      const val = numSeeded(seed, 20, 100);
      return `${indicator} for ${symbol}: ${val.toFixed(1)}\nInterpretation: ${val > 60 ? "Above average — bullish bias" : "Below average — bearish bias"}.`;
    }
  }
}

// ─── ANALYZE SENTIMENT ─────────────────────────────────────

function simulateAnalyzeSentiment(topic: string, depth: string): string {
  const seed = topic;
  const social = numSeeded(seed + "soc", 20, 88);
  const putCall = numSeeded(seed + "pc", 0.4, 1.5);
  const flow = numSeeded(seed + "flow", -3, 4);
  const fear = numSeeded(seed + "fear", 15, 90);
  const retail = numSeeded(seed + "ret", 20, 85);

  const socialLabel = social > 70 ? "Extremely Bullish" : social > 55 ? "Bullish" : social > 45 ? "Neutral" : social > 30 ? "Bearish" : "Extremely Bearish";
  const contrarian = (social > 75 || social < 25) ? "\n⚠️ CONTRARIAN WARNING: Extreme sentiment often precedes reversals." : "";

  let result = `Market Sentiment — ${topic}:
- Social Media: ${social.toFixed(0)}% bullish (${socialLabel})
- Put/Call Ratio: ${putCall.toFixed(2)} (${putCall < 0.7 ? "Bullish" : putCall > 1.0 ? "Bearish" : "Neutral"})
- Institutional Flow: ${flow > 0 ? `Net buyers $${flow.toFixed(1)}B` : `Net sellers $${Math.abs(flow).toFixed(1)}B`}
- Fear & Greed: ${fear.toFixed(0)} (${fear > 75 ? "Extreme Greed" : fear > 55 ? "Greed" : fear > 45 ? "Neutral" : fear > 25 ? "Fear" : "Extreme Fear"})
- Retail Activity: ${retail.toFixed(0)}% bullish${contrarian}`;

  if (depth === "detailed") {
    const smartMoney = numSeeded(seed + "sm", 30, 80);
    const optionsSkew = numSeeded(seed + "skew", -5, 5);
    result += `\n\n--- DETAILED BREAKDOWN ---
- Smart Money Index: ${smartMoney.toFixed(0)} (${smartMoney > 60 ? "smart money buying" : "smart money cautious"})
- Options Skew: ${optionsSkew > 0 ? "+" : ""}${optionsSkew.toFixed(1)} (${optionsSkew > 2 ? "heavy call buying" : optionsSkew < -2 ? "heavy put buying" : "balanced"})
- Short Interest: ${numSeeded(seed + "si", 2, 20).toFixed(1)}% of float (${numSeeded(seed + "si", 2, 20) > 15 ? "HIGH — squeeze potential" : "normal"})
- Analyst Consensus: ${numSeeded(seed + "an", 1, 5).toFixed(1)}/5.0 (${numSeeded(seed + "an", 1, 5) > 3.5 ? "Buy" : "Hold"})`;
  }

  return result;
}

// ─── HISTORICAL PATTERN ────────────────────────────────────

function simulateHistoricalPattern(scenario: string, timeframe: string): string {
  const seed = scenario + timeframe;
  const outcomes = [
    { date: pickSeeded(["Mar 2020", "Jun 2019", "Oct 2022", "Jan 2018", "Sep 2021"], seed + "d1"), move: numSeeded(seed + "m1", -15, 20), desc: "Similar macro conditions" },
    { date: pickSeeded(["Aug 2015", "Dec 2018", "Feb 2023", "May 2019", "Nov 2020"], seed + "d2"), move: numSeeded(seed + "m2", -12, 18), desc: "Comparable market structure" },
    { date: pickSeeded(["Apr 2022", "Jul 2020", "Mar 2019", "Oct 2023", "Jan 2021"], seed + "d3"), move: numSeeded(seed + "m3", -10, 15), desc: "Analogous catalyst type" },
  ];

  const avg = outcomes.reduce((s, o) => s + o.move, 0) / outcomes.length;
  const variance = outcomes.reduce((s, o) => s + Math.pow(o.move - avg, 2), 0) / outcomes.length;

  return `Historical Pattern Matches for: "${scenario}"\nTimeframe: ${timeframe}\n\n${outcomes.map((o, i) => `${i + 1}. ${o.date}: ${o.desc}\n   Outcome: ${o.move > 0 ? "+" : ""}${o.move}% over ${timeframe}`).join("\n")}\n\nAverage outcome: ${avg > 0 ? "+" : ""}${avg.toFixed(1)}%\nVariance: ${variance.toFixed(1)} (${variance > 50 ? "HIGH — outcomes diverge" : "MODERATE — reasonable consistency"})\nConfidence: ${variance > 50 ? "LOW" : "MODERATE"} (3 analogs).`;
}

// ─── CALCULATE PROBABILITY ─────────────────────────────────

function simulateCalculateProbability(event: string, factors: string): string {
  const seed = event + factors;
  const baseRate = numSeeded(seed, 10, 70);
  const factorList = factors ? factors.split(",").map(f => f.trim()) : ["market conditions", "historical precedent"];

  const adjustments = factorList.map(f => ({
    factor: f,
    adjustment: numSeeded(seed + f, -15, 15),
  }));

  const totalAdj = adjustments.reduce((s, a) => s + a.adjustment, 0);
  const finalProb = Math.max(2, Math.min(98, Math.round(baseRate + totalAdj)));

  return `Probability: "${event}"\n\nBase Rate: ${baseRate.toFixed(0)}%\n\nAdjustments:\n${adjustments.map(a => `- ${a.factor}: ${a.adjustment > 0 ? "+" : ""}${a.adjustment.toFixed(1)}%`).join("\n")}\n\nFinal: ${finalProb}% [${Math.max(1, finalProb - 12)}% — ${Math.min(99, finalProb + 12)}%]\nMethod: Bayesian updating with factor-specific adjustments.`;
}
