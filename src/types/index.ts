// ─── AGENT TOOL & CONFIG TYPES ─────────────────────────────

export type AgentToolName =
  | "search_news"
  | "calculate_indicator"
  | "analyze_sentiment"
  | "get_historical_pattern"
  | "calculate_probability";

export type AnalysisSchool =
  | "technical"
  | "institutional"
  | "macro"
  | "thematic"
  | "sentiment";

export interface BotAnalysisFramework {
  philosophy: string;
  primary_school: AnalysisSchool;
  secondary_schools: AnalysisSchool[];
  selected_indicators: string[];
  custom_indicator?: {
    name: string;
    components: string[];
    formula_description: string;
    interpretation: string;
  };
  decision_process: string;
  risk_personality: "aggressive" | "moderate" | "conservative" | "adaptive";
}

export interface AgentConfig {
  allowed_tools: AgentToolName[];
  temperature: number;
  thinking_budget: number;
  max_tool_rounds: number;
  archetype: string;
  analysis_framework?: BotAnalysisFramework;
}

export interface AgentStep {
  step_number: number;
  type: "thinking" | "tool_call" | "tool_result" | "decision";
  content: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  timestamp: string;
}

export interface AgentDecisionTrace {
  bot_id: string;
  steps: AgentStep[];
  final_decision: string | number;
  total_tokens_used: number;
  tools_used: string[];
  thinking_time_ms: number;
}

// ─── POKER TYPES ───────────────────────────────────────────

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type CardRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  suit: Suit;
  rank: CardRank;
}

export type PokerAction = "fold" | "check" | "call" | "raise" | "all_in";

export interface PokerHandResult {
  rank: number;
  name: string;
  description: string;
  kickers: number[];
}

// ─── CORE BOT ──────────────────────────────────────────────

export interface Bot {
  id: string;
  name: string;
  type_label: string;
  avatar_emoji: string;
  created_at: string;
  alive_days: number;
  win_rate: number;
  total_matches: number;
  wins: number;
  losses: number;
  rank: number;
  status: "active" | "sold" | "eliminated";
  price: number;
  hidden_persona?: string;
  hidden_strategy?: string;
  hidden_background?: string;
  buyer_id?: string | null;
  buyer_name?: string;
  season_status?: "alive" | "eliminated" | "champion";
  league_status?: "active" | "eliminated";
  eliminated_in_round?: number;
  survival_streak?: number;
  betrayals?: number;
  cumulative_return?: number;
  accuracy?: number;
  optimal_deviation?: number;
  monthly_score?: number;
  memory?: BotMemoryEntry[];
  agent_config?: AgentConfig;
  persona_profile?: BotPersonaData;
}

export interface BotPersonaData {
  age: number;
  gender: string;
  nationality: string;
  city: string;
  family_wealth: string;
  education_level: string;
  education_field: string;
  career_years: number;
  career_path: string[];
  domain_expertise: string[];
  personality_summary: string;
  cognitive_style: string;
  decision_speed: string;
  confidence_level: string;
  risk_personality: string;
  biggest_win: string;
  biggest_loss: string;
  philosophy: string;
  secret_fear: string;
  blind_spots: string[];
  cognitive_biases: string[];
  communication_tone: string;
  catchphrases: string[];
}

export interface BotMemoryEntry {
  round_number: number;
  season_number: number;
  game_type: string;
  decision: string;
  reasoning: string;
  outcome: string;
  score: number;
  optimal_answer: string;
  optimal_delta: number;
  reflection: string;
}

// ─── MONTHLY LEAGUE ────────────────────────────────────────

export interface MonthlyLeague {
  id: string;
  month: string;
  status: "active" | "completed";
  started_at: string;
  ended_at?: string;
  total_bots: number;
  daily_challenges: DailyChallenge[];
  special_events: Round[];
  special_event_schedule: SpecialEventSchedule[];
  standings: LeagueStanding[];
  hall_of_fame?: HallOfFameEntry[];
}

export type DailyChallengeType =
  | "us_market"
  | "tw_market"
  | "crypto"
  | "forex"
  | "gold"
  /** LLM curator proposes verifiable same-day / short-horizon news & markets questions */
  | "current_events";

/** Curator-proposed topic; must be objectively verifiable by deadline. */
export interface CuratedEventTopic {
  headline: string;
  question_text: string;
  resolution_type: "yes_no" | "up_down" | "multi_choice";
  /** Normalized keys bots must answer with, e.g. ["yes","no"] or ["up","down"] or ["A","B","C"] */
  valid_outcomes: string[];
  resolution_deadline_iso: string;
  verification_plan: string;
  news_anchors: string;
  curator_confidence: number;
}

/** After verifier confirms outcome (separate LLM pass + tools). */
export interface EventResolution {
  resolved_at: string;
  outcome_key: string;
  outcome_label: string;
  verification_summary: string;
}

export interface DailyChallenge {
  id: string;
  league_id: string;
  date: string;
  challenge_type: DailyChallengeType;
  status: "open" | "locked" | "settled";
  market_data: MarketSnapshot;
  predictions: DailyPrediction[];
  actual_result?: MarketResult;
  /** Set when challenge_type === current_events */
  event_topic?: CuratedEventTopic;
  event_resolution?: EventResolution;
  events: GameEvent[];
}

export interface DailyPrediction {
  bot_id: string;
  direction: "up" | "down";
  predicted_change: number;
  /** For current_events: must match EventResolution.outcome_key when settled */
  event_answer?: string;
  stock_picks?: StockPick[];
  reasoning: string;
  inner_thought: string;
  score?: number;
  decision_trace?: AgentDecisionTrace;
}

export interface StockPick {
  symbol: string;
  name: string;
  predicted_direction: "up" | "down";
  predicted_change: number;
  actual_change?: number;
  correct?: boolean;
}

export interface MarketSnapshot {
  index_name: string;
  previous_close: number;
  current_price?: number;
  pre_market_change?: number;
  context: string;
}

export interface MarketResult {
  close_price: number;
  change_percent: number;
  direction: "up" | "down";
  stock_results?: Record<string, number>;
}

export interface LeagueStanding {
  bot_id: string;
  total_score: number;
  daily_scores: number;
  special_scores: number;
  predictions_made: number;
  correct_directions: number;
  accuracy: number;
  rank: number;
  trend: "up" | "down" | "same";
}

export interface HallOfFameEntry {
  month: string;
  rank: 1 | 2 | 3;
  bot_id: string;
  bot_snapshot: Bot;
  total_score: number;
  accuracy: number;
  buyer_name?: string;
}

export interface SpecialEventSchedule {
  game_type: GameType;
  scheduled_date: string;
  status: "upcoming" | "completed";
}

// ─── SEASON & ROUND (kept for special events) ──────────────

export interface Season {
  id: string;
  number: number;
  status: "upcoming" | "active" | "completed";
  started_at: string;
  ended_at?: string;
  total_bots: number;
  alive_bots: number;
  current_round: number;
  total_rounds: number;
  rounds: Round[];
  champion_id?: string;
  champion?: Bot;
}

export interface Round {
  id: string;
  season_id: string;
  round_number: number;
  game_type: GameType;
  game_name: string;
  game_description: string;
  status: "upcoming" | "active" | "completed";
  started_at?: string;
  ended_at?: string;
  participants: RoundParticipant[];
  events: GameEvent[];
  eliminated_ids: string[];
  survivor_count: number;
  summary?: string;
  challenge?: ChallengeData;
}

export type GameType =
  | "market_forecast"
  | "resource_allocation"
  | "prisoners_dilemma"
  | "risk_assessment"
  | "auction_wars"
  | "poker"
  | "stock_prediction"
  | "final_optimization";

export interface ChallengeData {
  scenario: string;
  variables: Record<string, string | number>;
  optimal_answer?: string;
  optimal_value?: number;
  explanation?: string;
}

export interface RoundParticipant {
  bot_id: string;
  bot?: Bot;
  survived: boolean;
  score?: number;
  decision?: string;
  reasoning?: string;
  optimal_delta?: number;
  profit?: number;
  decision_trace?: AgentDecisionTrace;
}

export interface GameEvent {
  id: string;
  timestamp: string;
  type:
    | "analysis"
    | "decision"
    | "reveal"
    | "outcome"
    | "elimination"
    | "twist"
    | "inner_thought"
    | "comparison"
    | "tool_call"
    | "tool_result"
    | "poker_action"
    | "poker_deal";
  actor_id?: string;
  actor_name?: string;
  target_id?: string;
  target_name?: string;
  content: string;
  is_dramatic?: boolean;
  data?: Record<string, string | number>;
}

// ─── LEGACY (kept for compatibility) ───────────────────────

export interface Match {
  id: string;
  bot_a_id: string;
  bot_b_id: string;
  bot_a?: Bot;
  bot_b?: Bot;
  topic: string;
  match_type: string;
  conversation: MatchMessage[];
  winner_id: string | null;
  judge_reasoning: string;
  created_at: string;
  is_featured: boolean;
}

export interface MatchMessage {
  role: "bot_a" | "bot_b" | "judge";
  content: string;
  bot_name?: string;
}

export interface Purchase {
  id: string;
  user_id: string;
  bot_id: string;
  price: number;
  purchased_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  bot: Bot;
  trend: "up" | "down" | "same" | "new";
  trend_value?: number;
}
