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
  // Hidden decision-making config (revealed on purchase)
  hidden_persona?: string;
  hidden_strategy?: string;
  hidden_background?: string;
  buyer_id?: string | null;
  // Season stats
  season_status?: "alive" | "eliminated" | "champion";
  eliminated_in_round?: number;
  survival_streak?: number;
  betrayals?: number;
  // Decision performance
  cumulative_return?: number; // Total profit/loss across rounds
  accuracy?: number; // Average prediction accuracy
  optimal_deviation?: number; // How far from theoretical optimal
}

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
  // Challenge-specific data
  challenge?: ChallengeData;
}

export type GameType =
  | "market_forecast"    // Predict price direction from signals
  | "resource_allocation" // Distribute resources optimally
  | "prisoners_dilemma"  // Iterated game theory with payoffs
  | "risk_assessment"    // Evaluate scenarios, calibrate probabilities
  | "auction_wars"       // Strategic bidding with optimal strategies
  | "final_optimization"; // Multi-variable optimization, 1 champion

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
  decision?: string; // The bot's chosen action/prediction
  reasoning?: string; // Brief reasoning shown publicly
  optimal_delta?: number; // Distance from optimal solution
  profit?: number; // Gain/loss this round
}

export interface GameEvent {
  id: string;
  timestamp: string;
  type: "analysis" | "decision" | "reveal" | "outcome" | "elimination" | "twist" | "inner_thought" | "comparison";
  actor_id?: string;
  actor_name?: string;
  target_id?: string;
  target_name?: string;
  content: string;
  is_dramatic?: boolean;
  data?: Record<string, string | number>; // Structured data for charts/comparisons
}

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
