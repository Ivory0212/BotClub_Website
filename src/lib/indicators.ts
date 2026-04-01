// ─── ANALYSIS SCHOOLS & INDICATORS ─────────────────────────
// Each "school" represents a philosophy of market analysis.
// Bots select indicators from schools that match their core persona,
// building a unified framework that drives ALL decisions — not just stocks.

export type AnalysisSchool =
  | "technical"       // 技術派：chart patterns, momentum, volume
  | "institutional"   // 籌碼派：money flow, smart money, positioning
  | "macro"           // 大盤派：economic data, rates, cross-market
  | "thematic"        // 題材派：sector rotation, narratives, cycles
  | "sentiment";      // 消息面：news, social, psychology

export interface Indicator {
  id: string;
  name: string;
  school: AnalysisSchool;
  description: string;
  usage_hint: string;
  data_format: string;
}

export interface AnalysisFramework {
  philosophy: string;
  primary_school: AnalysisSchool;
  secondary_schools: AnalysisSchool[];
  selected_indicators: string[];
  custom_indicator?: CustomIndicator;
  decision_process: string;
  risk_personality: "aggressive" | "moderate" | "conservative" | "adaptive";
}

export interface CustomIndicator {
  name: string;
  components: string[];
  formula_description: string;
  interpretation: string;
}

// ─── FULL INDICATOR CATALOG ────────────────────────────────

export const INDICATOR_CATALOG: Indicator[] = [
  // ── 技術派 Technical ──
  { id: "rsi", name: "RSI (Relative Strength Index)", school: "technical", description: "Momentum oscillator measuring speed and magnitude of price changes", usage_hint: "Overbought >70, Oversold <30. Divergences signal reversals.", data_format: "0-100 scale" },
  { id: "macd", name: "MACD (Moving Average Convergence Divergence)", school: "technical", description: "Trend-following momentum indicator showing relationship between two moving averages", usage_hint: "Bullish when MACD crosses above signal line. Histogram shows momentum strength.", data_format: "MACD line, Signal line, Histogram" },
  { id: "bollinger", name: "Bollinger Bands", school: "technical", description: "Volatility bands placed above and below a moving average", usage_hint: "Price near upper band = overextended. Band squeeze = breakout imminent.", data_format: "Upper, Middle, Lower bands + %B" },
  { id: "kd", name: "KD Stochastic", school: "technical", description: "Momentum indicator comparing closing price to price range over a period", usage_hint: "K crossing above D = buy signal. >80 overbought, <20 oversold.", data_format: "%K and %D values 0-100" },
  { id: "ma_cross", name: "Moving Average Crossover", school: "technical", description: "Golden/Death cross using short-term and long-term moving averages", usage_hint: "Golden cross (50MA>200MA) = bullish trend. Death cross = bearish.", data_format: "SMA/EMA values + cross status" },
  { id: "volume_profile", name: "Volume Profile Analysis", school: "technical", description: "Distribution of volume at different price levels identifying support/resistance", usage_hint: "High volume nodes = strong support/resistance. Low volume = potential fast moves.", data_format: "Volume at price levels + POC" },
  { id: "fibonacci", name: "Fibonacci Retracement", school: "technical", description: "Key retracement levels (23.6%, 38.2%, 50%, 61.8%) after significant moves", usage_hint: "Price tends to retrace to Fib levels before continuing trend. 61.8% is the golden ratio.", data_format: "Retracement levels with prices" },
  { id: "ichimoku", name: "Ichimoku Cloud", school: "technical", description: "All-in-one indicator showing support/resistance, momentum, and trend direction", usage_hint: "Price above cloud = bullish. Cloud twist = trend change. Lagging span confirms.", data_format: "Tenkan, Kijun, Senkou A/B, Chikou" },
  { id: "atr", name: "ATR (Average True Range)", school: "technical", description: "Measures market volatility by decomposing the entire range of price movement", usage_hint: "High ATR = volatile, wider stops needed. Low ATR = calm, breakout may come.", data_format: "Dollar value per period" },
  { id: "support_resistance", name: "Support/Resistance Levels", school: "technical", description: "Key price levels where buying or selling pressure historically concentrates", usage_hint: "Breakout above resistance = bullish continuation. Break below support = bearish.", data_format: "Price levels with strength rating" },
  { id: "candlestick", name: "Candlestick Patterns", school: "technical", description: "Pattern recognition on price bars (doji, hammer, engulfing, etc.)", usage_hint: "Hammer at support = reversal. Engulfing patterns signal momentum shift.", data_format: "Pattern name + reliability score" },
  { id: "divergence", name: "Price-Indicator Divergence", school: "technical", description: "When price makes new high/low but indicator doesn't confirm", usage_hint: "Bearish divergence: price up, RSI down. Strong reversal signal.", data_format: "Divergence type + strength" },

  // ── 籌碼派 Institutional Flow ──
  { id: "foreign_flow", name: "Foreign Investor Flow", school: "institutional", description: "Net buying/selling by foreign institutional investors", usage_hint: "Persistent foreign buying = bullish. Sudden outflow = risk-off signal.", data_format: "Net buy/sell in $M + consecutive days" },
  { id: "dealer_position", name: "Dealer/Market Maker Position", school: "institutional", description: "Net positions of dealers and self-operated trading desks", usage_hint: "Dealers hedging short = market makers expect upside. Position changes signal intent.", data_format: "Net position change + hedging ratio" },
  { id: "margin_trading", name: "Margin Trading Balance", school: "institutional", description: "Outstanding margin loans and short selling balance", usage_hint: "Rising margin = leveraged bullish bets. Margin call risk at peaks.", data_format: "Margin balance + change + utilization rate" },
  { id: "put_call_ratio", name: "Put/Call Ratio", school: "institutional", description: "Ratio of put options to call options traded", usage_hint: "High P/C (>1.2) = fear = contrarian bullish. Low P/C (<0.6) = complacency.", data_format: "Ratio value + percentile rank" },
  { id: "dark_pool", name: "Dark Pool Activity", school: "institutional", description: "Off-exchange trading volume indicating institutional activity", usage_hint: "Unusual dark pool volume = big players positioning. Direction revealed later.", data_format: "Dark pool % of volume + unusual flag" },
  { id: "fund_flow", name: "ETF/Fund Flow Data", school: "institutional", description: "Net inflows/outflows from major ETFs and mutual funds", usage_hint: "Sustained inflows = institutional allocation shift. Outflows = risk reduction.", data_format: "Weekly net flow in $M + trend" },
  { id: "insider_trading", name: "Insider Transaction Monitor", school: "institutional", description: "Buy/sell transactions by company officers and directors", usage_hint: "Cluster buying by multiple insiders = strong conviction signal.", data_format: "Net insider buy/sell + cluster flag" },
  { id: "institutional_ownership", name: "Institutional Ownership Changes", school: "institutional", description: "Quarterly 13F filing changes showing hedge fund/institution position shifts", usage_hint: "Smart money consensus shifts are leading indicators.", data_format: "Ownership % change + top holder changes" },

  // ── 大盤派 Macro ──
  { id: "gdp", name: "GDP Growth Rate", school: "macro", description: "Quarterly gross domestic product growth rate", usage_hint: "Accelerating GDP = risk-on. Decelerating = defensive positioning.", data_format: "QoQ and YoY % growth" },
  { id: "cpi", name: "CPI / Inflation Data", school: "macro", description: "Consumer Price Index measuring inflation trajectory", usage_hint: "Rising CPI = rate hike pressure = bearish for growth stocks. Falling = dovish shift.", data_format: "MoM and YoY % + core CPI" },
  { id: "interest_rate", name: "Interest Rate / Fed Funds", school: "macro", description: "Central bank policy rate and forward guidance", usage_hint: "Rate hikes = tightening = bearish. Cuts/pauses = easing = bullish.", data_format: "Current rate + dot plot expectations" },
  { id: "yield_curve", name: "Yield Curve Analysis", school: "macro", description: "Spread between short-term and long-term government bond yields", usage_hint: "Inverted yield curve = recession signal. Steepening = recovery.", data_format: "2Y-10Y spread + inversion status" },
  { id: "vix", name: "VIX (Volatility Index)", school: "macro", description: "Market's expectation of 30-day forward-looking volatility", usage_hint: "VIX >30 = extreme fear. VIX <15 = complacency. Spikes signal panic.", data_format: "VIX level + percentile + term structure" },
  { id: "dollar_index", name: "US Dollar Index (DXY)", school: "macro", description: "Trade-weighted measure of the US dollar against major currencies", usage_hint: "Strong dollar = headwind for commodities and EM. Weak dollar = risk-on.", data_format: "DXY level + trend direction" },
  { id: "oil_price", name: "Crude Oil Price", school: "macro", description: "WTI/Brent crude oil price as inflation and growth proxy", usage_hint: "Oil spike = inflation fear. Oil crash = demand destruction signal.", data_format: "Price + % change + inventory data" },
  { id: "pmi", name: "PMI (Purchasing Managers Index)", school: "macro", description: "Leading indicator of manufacturing and services economic health", usage_hint: "PMI >50 = expansion. <50 = contraction. Direction matters more than level.", data_format: "Manufacturing + Services PMI values" },
  { id: "unemployment", name: "Employment/Unemployment Data", school: "macro", description: "Non-farm payrolls, unemployment rate, jobless claims", usage_hint: "Rising unemployment = recession risk. Strong jobs = hawkish Fed.", data_format: "NFP change + unemployment rate + claims" },
  { id: "money_supply", name: "Money Supply (M2)", school: "macro", description: "Total money supply in the economy — liquidity measure", usage_hint: "M2 growth = liquidity tailwind for assets. M2 contraction = headwind.", data_format: "M2 level + YoY growth rate" },

  // ── 題材派 Thematic ──
  { id: "ai_semiconductor", name: "AI & Semiconductor Cycle", school: "thematic", description: "AI infrastructure spending, chip demand, and data center buildout trends", usage_hint: "CapEx announcements drive sentiment. Supply constraints = pricing power.", data_format: "CapEx growth + utilization rate + order backlog" },
  { id: "green_energy", name: "Green Energy / ESG", school: "thematic", description: "Renewable energy policy, subsidies, and adoption trajectory", usage_hint: "Policy tailwinds drive sector. Subsidy changes = immediate re-pricing.", data_format: "Policy score + adoption rate + subsidy status" },
  { id: "ev_mobility", name: "EV & Mobility Transition", school: "thematic", description: "Electric vehicle sales, charging infrastructure, battery technology", usage_hint: "Sales data vs expectations drives sentiment. Battery breakthroughs = catalysts.", data_format: "EV sales growth + market share + supply chain" },
  { id: "geopolitics", name: "Geopolitical Risk Monitor", school: "thematic", description: "Trade tensions, sanctions, military conflicts, election impacts", usage_hint: "Escalation = risk-off, defense/energy up. De-escalation = risk-on.", data_format: "Risk score + affected sectors + scenario analysis" },
  { id: "supply_chain", name: "Supply Chain & Reshoring", school: "thematic", description: "Global supply chain disruptions, nearshoring trends, logistics costs", usage_hint: "Disruptions = inflation + rotation to domestic. Normalization = margin recovery.", data_format: "Supply chain stress index + shipping rates" },
  { id: "biotech_pharma", name: "Biotech / Pharma Pipeline", school: "thematic", description: "FDA approvals, clinical trial results, patent cliffs", usage_hint: "Binary events: approval = surge, rejection = crash. Pipeline depth matters.", data_format: "Pipeline stage + probability of success + market size" },
  { id: "sector_rotation", name: "Sector Rotation Model", school: "thematic", description: "Business cycle-based sector performance expectations", usage_hint: "Early cycle: cyclicals. Mid: tech. Late: energy/staples. Recession: utilities.", data_format: "Cycle phase + recommended sectors + rotation signals" },
  { id: "regulation", name: "Regulatory & Policy Tracker", school: "thematic", description: "Upcoming regulation, antitrust, tax policy changes", usage_hint: "New regulation = headwind for targets. Deregulation = tailwind.", data_format: "Pending actions + probability + impact assessment" },

  // ── 消息面 Sentiment/News ──
  { id: "earnings_surprise", name: "Earnings Surprise Tracker", school: "sentiment", description: "Company earnings vs analyst consensus + guidance quality", usage_hint: "Beat + raise = strong momentum. Beat + lower guide = sell the news.", data_format: "EPS surprise % + revenue surprise % + guidance direction" },
  { id: "analyst_ratings", name: "Analyst Rating Changes", school: "sentiment", description: "Upgrades, downgrades, and price target changes from sell-side", usage_hint: "Cluster upgrades = consensus building. Contrarian: fade extreme consensus.", data_format: "Rating changes + consensus target + dispersion" },
  { id: "social_sentiment", name: "Social Media Sentiment", school: "sentiment", description: "Aggregated sentiment from Twitter/Reddit/StockTwits and retail platforms", usage_hint: "Extreme retail bullishness = contrarian sell signal. Panic selling = buy signal.", data_format: "Bullish % + volume + trending topics" },
  { id: "news_flow", name: "News Flow Intensity", school: "sentiment", description: "Volume and direction of news coverage for a topic/sector", usage_hint: "Abnormal news flow precedes moves. Silence after big moves = continuation.", data_format: "News count + sentiment score + anomaly flag" },
  { id: "ceo_signal", name: "CEO & Management Signals", school: "sentiment", description: "Executive comments, conference call tone analysis, strategic shifts", usage_hint: "Tone changes matter more than words. Unusual optimism/pessimism = signal.", data_format: "Tone score + key phrases + change from prior" },
  { id: "event_calendar", name: "Event Calendar Impact", school: "sentiment", description: "Upcoming scheduled events: FOMC, earnings, ex-dividend, options expiry", usage_hint: "Position ahead of catalysts. Options expiry = increased volatility.", data_format: "Upcoming events + historical impact + positioning" },
  { id: "retail_flow", name: "Retail Investor Flow", school: "sentiment", description: "Retail trading activity from broker data and order flow", usage_hint: "Retail surges often mark local tops. Retail capitulation = bottoms.", data_format: "Retail buy/sell ratio + popular tickers + flow $M" },
  { id: "fear_greed", name: "Fear & Greed Composite", school: "sentiment", description: "Multi-factor sentiment index combining VIX, momentum, volume, and positioning", usage_hint: "Extreme fear (<20) = buy opportunity. Extreme greed (>80) = reduce risk.", data_format: "Index 0-100 + component breakdown" },
];

// ─── SCHOOL METADATA ───────────────────────────────────────

export const SCHOOL_INFO: Record<AnalysisSchool, { label: string; label_tw: string; philosophy: string; strength: string; weakness: string }> = {
  technical: {
    label: "Technical Analysis",
    label_tw: "技術分析派",
    philosophy: "Price action and patterns contain all relevant information. History repeats.",
    strength: "Precise entry/exit timing, works in trending markets",
    weakness: "Fails during regime changes, can't predict fundamentally-driven moves",
  },
  institutional: {
    label: "Institutional Flow",
    label_tw: "籌碼分析派",
    philosophy: "Follow the smart money. Institutional positioning reveals true market direction.",
    strength: "Identifies large-scale positioning shifts before they impact price",
    weakness: "Lagging data, institutions can be wrong collectively",
  },
  macro: {
    label: "Macro Economics",
    label_tw: "總經大盤派",
    philosophy: "Economic fundamentals drive long-term asset prices. Cycles are predictable.",
    strength: "Big-picture context, identifies regime shifts early",
    weakness: "Too slow for short-term trading, market can diverge from fundamentals for years",
  },
  thematic: {
    label: "Thematic / Sector",
    label_tw: "題材趨勢派",
    philosophy: "Major themes and narratives create multi-year investment opportunities.",
    strength: "Captures mega-trends, identifies structural shifts",
    weakness: "Timing is everything — too early is the same as wrong",
  },
  sentiment: {
    label: "News & Sentiment",
    label_tw: "消息情緒面",
    philosophy: "Markets are driven by psychology. Information asymmetry creates edge.",
    strength: "Captures short-term catalysts, reads crowd psychology",
    weakness: "Noise overwhelms signal, confirmation bias risk",
  },
};

// ─── HELPERS ───────────────────────────────────────────────

export function getIndicatorsBySchool(school: AnalysisSchool): Indicator[] {
  return INDICATOR_CATALOG.filter(i => i.school === school);
}

export function getIndicatorById(id: string): Indicator | undefined {
  return INDICATOR_CATALOG.find(i => i.id === id);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickMultiple<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.min(arr.length, min + Math.floor(Math.random() * (max - min + 1)));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ─── CUSTOM INDICATOR GENERATION ───────────────────────────

const CUSTOM_INDICATOR_TEMPLATES = [
  {
    pattern: (components: string[]) => ({
      name: `Composite Momentum Score (${components.length}-Factor)`,
      formula_description: `Weighted average of ${components.join(", ")} normalized to 0-100 scale, with dynamic weights shifting based on volatility regime`,
      interpretation: "Score >70 = strong buy. <30 = strong sell. 40-60 = hold. Weight shifts toward mean-reversion indicators in high-volatility environments.",
    }),
  },
  {
    pattern: (components: string[]) => ({
      name: `Convergence Signal Matrix`,
      formula_description: `Counts agreement across ${components.join(", ")}. Signal fires only when ${Math.min(3, components.length)}+ indicators agree on direction`,
      interpretation: "Full convergence = high-conviction trade. Divergence = stay flat. Partial agreement = half-position size.",
    }),
  },
  {
    pattern: (components: string[]) => ({
      name: `Adaptive Risk-Reward Engine`,
      formula_description: `Calculates expected value using ${components.join(", ")} as inputs. Position size = Kelly fraction × (edge / odds) capped at 25% portfolio`,
      interpretation: "Only trades when expected value > 1.5:1. Scales position by confidence level. Auto-reduces in drawdowns.",
    }),
  },
  {
    pattern: (components: string[]) => ({
      name: `Cross-Domain Pattern Detector`,
      formula_description: `Maps patterns from ${components[0]} domain to current situation. Uses structural similarity matching across ${components.join(", ")}`,
      interpretation: "Treats all decisions as pattern-matching problems. High match confidence = decisive action. Low match = conservative default.",
    }),
  },
  {
    pattern: (components: string[]) => ({
      name: `Multi-Timeframe Consensus Model`,
      formula_description: `Evaluates ${components.join(", ")} across 3 timeframes (short/medium/long). Requires 2/3 timeframe agreement for position`,
      interpretation: "All timeframes aligned = maximum position. Conflicting signals = reduced size or flat. Uses shorter timeframe for entry timing.",
    }),
  },
];

export function generateCustomIndicator(selectedIndicators: string[]): CustomIndicator {
  const components = pickMultiple(selectedIndicators, 2, Math.min(4, selectedIndicators.length));
  const template = pickRandom(CUSTOM_INDICATOR_TEMPLATES);
  const names = components.map(id => getIndicatorById(id)?.name ?? id);
  const result = template.pattern(names);
  return { ...result, components };
}

// ─── FRAMEWORK GENERATION ──────────────────────────────────
// Called by bot-generator to build a bot's unified analysis framework.

export interface SchoolAffinity {
  school: AnalysisSchool;
  weight: number;
}

export function buildAnalysisFramework(
  affinities: SchoolAffinity[],
  riskPersonality: "aggressive" | "moderate" | "conservative" | "adaptive",
  philosophyOverride?: string,
): AnalysisFramework {
  const sorted = [...affinities].sort((a, b) => b.weight - a.weight);
  const primary = sorted[0].school;
  const secondary = sorted.slice(1).filter(a => a.weight > 0.2).map(a => a.school);

  const selectedIndicators: string[] = [];

  const primaryIndicators = getIndicatorsBySchool(primary);
  const primaryPicks = pickMultiple(primaryIndicators, 3, 5);
  selectedIndicators.push(...primaryPicks.map(i => i.id));

  for (const sec of secondary) {
    const secIndicators = getIndicatorsBySchool(sec);
    const secPicks = pickMultiple(secIndicators, 1, 3);
    selectedIndicators.push(...secPicks.map(i => i.id));
  }

  const shouldCreateCustom = Math.random() > 0.3;
  const custom = shouldCreateCustom ? generateCustomIndicator(selectedIndicators) : undefined;

  const primaryInfo = SCHOOL_INFO[primary];
  const philosophy = philosophyOverride ?? `${primaryInfo.philosophy} Secondary lens: ${secondary.map(s => SCHOOL_INFO[s].label_tw).join("、") || "none"}.`;

  const decisionProcess = buildDecisionProcess(primary, secondary, riskPersonality, selectedIndicators);

  return {
    philosophy,
    primary_school: primary,
    secondary_schools: secondary,
    selected_indicators: selectedIndicators,
    custom_indicator: custom,
    decision_process: decisionProcess,
    risk_personality: riskPersonality,
  };
}

function buildDecisionProcess(
  primary: AnalysisSchool,
  secondary: AnalysisSchool[],
  risk: string,
  indicators: string[],
): string {
  const steps: string[] = [];

  steps.push(`1. [Core Analysis] Apply ${SCHOOL_INFO[primary].label_tw} framework using: ${indicators.slice(0, 4).map(id => getIndicatorById(id)?.name ?? id).join(", ")}`);

  if (secondary.length > 0) {
    steps.push(`2. [Cross-Validation] Check against ${secondary.map(s => SCHOOL_INFO[s].label_tw).join("、")} signals for confirmation/contradiction`);
  }

  steps.push(`${secondary.length > 0 ? "3" : "2"}. [Signal Aggregation] Combine all indicator readings into a directional conviction score`);

  const riskStep = {
    aggressive: "Take full-size position if conviction >60%. Double down on high-conviction setups.",
    moderate: "Scale position by conviction level. Full size only above 75% conviction.",
    conservative: "Require 80%+ conviction AND cross-validation agreement to act. Default to smallest position.",
    adaptive: "Adjust position sizing based on recent performance. Increase after wins, decrease after losses.",
  }[risk] ?? "Standard position sizing.";

  steps.push(`${secondary.length > 0 ? "4" : "3"}. [Risk & Sizing] ${riskStep}`);
  steps.push(`${secondary.length > 0 ? "5" : "4"}. [Final Decision] Generate prediction with reasoning chain traceable to specific indicator readings`);

  return steps.join("\n");
}

// ─── INDICATOR DESCRIPTION FOR PROMPTS ─────────────────────

export function formatFrameworkForPrompt(framework: AnalysisFramework): string {
  const primaryLabel = SCHOOL_INFO[framework.primary_school].label_tw;
  const indicatorList = framework.selected_indicators
    .map(id => {
      const ind = getIndicatorById(id);
      return ind ? `• ${ind.name}: ${ind.usage_hint}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const customSection = framework.custom_indicator
    ? `\n\nCUSTOM INDICATOR — ${framework.custom_indicator.name}:\n${framework.custom_indicator.formula_description}\nInterpretation: ${framework.custom_indicator.interpretation}`
    : "";

  return `YOUR ANALYSIS FRAMEWORK (use this for ALL decisions):
Core School: ${primaryLabel}
Philosophy: ${framework.philosophy}
Risk Profile: ${framework.risk_personality}

YOUR INDICATORS:
${indicatorList}${customSection}

YOUR DECISION PROCESS:
${framework.decision_process}

IMPORTANT: Apply this same analytical framework to EVERY challenge — stocks, poker, auctions, risk assessment. Your indicators are your lens for understanding ANY competitive situation. A technical analyst sees poker as price action patterns. A sentiment analyst reads opponents' emotions. Stay true to your framework.`;
}
