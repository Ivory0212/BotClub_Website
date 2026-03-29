import type { Bot, Season, Round } from "@/types";
import { generateBotPersona } from "./bot-generator";
import { simulateRound, getSeasonRoundPlan, GAME_CONFIGS } from "./game-engine";
import type { GameType } from "@/types";

// Use globalThis to persist data across hot reloads in dev mode
const globalStore = globalThis as unknown as {
  __botclub_bots?: Bot[];
  __botclub_seasons?: Season[];
  __botclub_initialized?: boolean;
};

let bots: Bot[] = globalStore.__botclub_bots ?? [];
let seasons: Season[] = globalStore.__botclub_seasons ?? [];
let initialized: boolean = globalStore.__botclub_initialized ?? false;

function persistGlobal() {
  globalStore.__botclub_bots = bots;
  globalStore.__botclub_seasons = seasons;
  globalStore.__botclub_initialized = initialized;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function calculatePrice(bot: Bot): number {
  const basePrice = 5;
  const rankBonus = Math.max(0, (50 - bot.rank) * 3);
  const winRateBonus = bot.win_rate * 150;
  const survivalBonus = bot.alive_days * 5;
  const championBonus = bot.season_status === "champion" ? 500 : 0;
  return Math.round(basePrice + rankBonus + winRateBonus + survivalBonus + championBonus);
}

function calculateRanks() {
  const activeBots = bots
    .filter((b) => b.status === "active")
    .sort((a, b) => {
      // Champions first, then by cumulative return, then survival streak, then win rate
      if ((b.season_status === "champion" ? 1 : 0) !== (a.season_status === "champion" ? 1 : 0)) {
        return (b.season_status === "champion" ? 1 : 0) - (a.season_status === "champion" ? 1 : 0);
      }
      const returnDiff = (b.cumulative_return ?? 0) - (a.cumulative_return ?? 0);
      if (Math.abs(returnDiff) > 5) return returnDiff;
      if (b.survival_streak !== a.survival_streak) return (b.survival_streak ?? 0) - (a.survival_streak ?? 0);
      if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
      return b.alive_days - a.alive_days;
    });

  activeBots.forEach((bot, index) => {
    bot.rank = index + 1;
    bot.price = calculatePrice(bot);
  });
}

export function initializeStore() {
  if (initialized) return;
  initialized = true;

  // Generate 50 bots
  for (let i = 0; i < 50; i++) {
    const persona = generateBotPersona();
    const aliveDays = Math.floor(Math.random() * 30) + 1;

    const bot: Bot = {
      id: generateId(),
      name: persona.name,
      type_label: persona.type_label,
      avatar_emoji: persona.avatar_emoji,
      created_at: new Date(Date.now() - aliveDays * 86400000).toISOString(),
      alive_days: aliveDays,
      win_rate: Math.random() * 0.6 + 0.2,
      total_matches: Math.floor(Math.random() * 20) + 1,
      wins: 0,
      losses: 0,
      rank: 0,
      status: "active",
      price: 0,
      hidden_persona: persona.hidden_persona,
      hidden_strategy: persona.hidden_strategy,
      hidden_background: persona.hidden_background,
      season_status: "alive",
      survival_streak: Math.floor(Math.random() * 5),
      betrayals: Math.floor(Math.random() * 3),
      cumulative_return: Math.round((Math.random() - 0.3) * 200),
      accuracy: Math.random() * 0.4 + 0.4,
      optimal_deviation: Math.round(Math.random() * 30),
    };
    bot.wins = Math.floor(bot.win_rate * bot.total_matches);
    bot.losses = bot.total_matches - bot.wins;
    bots.push(bot);
  }

  calculateRanks();

  // Generate a completed season with full data
  generateCompletedSeason();
  persistGlobal();
}

function generateCompletedSeason() {
  const seasonBots = bots.filter((b) => b.status === "active").slice(0, 40);
  const roundPlan = getSeasonRoundPlan(seasonBots.length);

  const season: Season = {
    id: generateId(),
    number: 1,
    status: "completed",
    started_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    ended_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    total_bots: seasonBots.length,
    alive_bots: 1,
    current_round: roundPlan.length,
    total_rounds: roundPlan.length,
    rounds: [],
  };

  let remaining = [...seasonBots];

  for (let i = 0; i < roundPlan.length; i++) {
    if (remaining.length <= 1) break;

    const gameType = roundPlan[i];
    const config = GAME_CONFIGS[gameType];

    const result = simulateRound(gameType, remaining);

    const round: Round = {
      id: generateId(),
      season_id: season.id,
      round_number: i + 1,
      game_type: gameType,
      game_name: config.name,
      game_description: config.description,
      status: "completed",
      started_at: new Date(Date.now() - (roundPlan.length - i) * 86400000).toISOString(),
      ended_at: new Date(Date.now() - (roundPlan.length - i) * 86400000 + 3600000).toISOString(),
      participants: result.participants,
      events: result.events,
      eliminated_ids: result.eliminatedIds,
      survivor_count: remaining.length - result.eliminatedIds.length,
      summary: `Round ${i + 1}: ${config.name} — ${result.eliminatedIds.length} eliminated, ${remaining.length - result.eliminatedIds.length} survive.`,
      challenge: result.challenge,
    };

    season.rounds.push(round);

    // Update bot performance stats from round results
    for (const p of result.participants) {
      const bot = bots.find((b) => b.id === p.bot_id);
      if (bot) {
        bot.cumulative_return = (bot.cumulative_return ?? 0) + (p.profit ?? 0);
        bot.total_matches += 1;
        if (p.survived) {
          bot.wins += 1;
          bot.survival_streak = (bot.survival_streak ?? 0) + 1;
        } else {
          bot.losses += 1;
          bot.survival_streak = 0;
        }
        bot.win_rate = bot.total_matches > 0 ? bot.wins / bot.total_matches : 0;
        if (p.optimal_delta !== undefined) {
          const prevTotal = (bot.accuracy ?? 0) * (bot.total_matches - 1);
          const score = Math.max(0, 100 - (p.optimal_delta * 2));
          bot.accuracy = (prevTotal + score) / bot.total_matches / 100;
          bot.optimal_deviation = Math.round(((bot.optimal_deviation ?? 0) * (bot.total_matches - 1) + p.optimal_delta) / bot.total_matches);
        }
      }
    }

    // Update eliminated bots
    for (const elimId of result.eliminatedIds) {
      const bot = bots.find((b) => b.id === elimId);
      if (bot) {
        bot.season_status = "eliminated";
        bot.eliminated_in_round = i + 1;
      }
    }

    remaining = remaining.filter((b) => !result.eliminatedIds.includes(b.id));
  }

  // Set champion
  if (remaining.length > 0) {
    const champion = remaining[0];
    champion.season_status = "champion";
    champion.survival_streak = (champion.survival_streak ?? 0) + roundPlan.length;
    season.champion_id = champion.id;
    season.champion = champion;
  }

  seasons.push(season);

  // Create upcoming season 2
  const season2: Season = {
    id: generateId(),
    number: 2,
    status: "active",
    started_at: new Date().toISOString(),
    total_bots: 50,
    alive_bots: 50,
    current_round: 0,
    total_rounds: getSeasonRoundPlan(50).length,
    rounds: [],
  };

  // Reset all bots for season 2
  bots.forEach((b) => {
    if (b.status === "active") {
      b.season_status = "alive";
      b.eliminated_in_round = undefined;
    }
  });

  seasons.push(season2);
  calculateRanks();
}

// ─── PUBLIC API ────────────────────────────────────────────

export function getAllBots(): Bot[] {
  initializeStore();
  return bots.filter((b) => b.status === "active").sort((a, b) => a.rank - b.rank);
}

export function getBotById(id: string): Bot | undefined {
  initializeStore();
  return bots.find((b) => b.id === id);
}

export function getAllSeasons(): Season[] {
  initializeStore();
  return [...seasons].sort((a, b) => b.number - a.number);
}

export function getSeasonById(id: string): Season | undefined {
  initializeStore();
  return seasons.find((s) => s.id === id);
}

export function getActiveSeason(): Season | undefined {
  initializeStore();
  return seasons.find((s) => s.status === "active") ?? seasons[seasons.length - 1];
}

export function getLatestCompletedSeason(): Season | undefined {
  initializeStore();
  return [...seasons].filter((s) => s.status === "completed").sort((a, b) => b.number - a.number)[0];
}

export function getRoundById(roundId: string): { season: Season; round: Round } | undefined {
  initializeStore();
  for (const season of seasons) {
    const round = season.rounds.find((r) => r.id === roundId);
    if (round) return { season, round };
  }
  return undefined;
}

export function runNextRound(): { season: Season; round: Round } | null {
  initializeStore();
  const season = seasons.find((s) => s.status === "active");
  if (!season) return null;

  const roundPlan = getSeasonRoundPlan(season.total_bots);
  const nextRoundNum = season.current_round + 1;
  if (nextRoundNum > roundPlan.length) return null;

  const gameType = roundPlan[nextRoundNum - 1] as GameType;
  const config = GAME_CONFIGS[gameType];
  const aliveBots = bots.filter((b) => b.status === "active" && b.season_status === "alive");

  if (aliveBots.length < 2) return null;

  const result = simulateRound(gameType, aliveBots);

  const round: Round = {
    id: generateId(),
    season_id: season.id,
    round_number: nextRoundNum,
    game_type: gameType,
    game_name: config.name,
    game_description: config.description,
    status: "completed",
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    participants: result.participants,
    events: result.events,
    eliminated_ids: result.eliminatedIds,
    survivor_count: aliveBots.length - result.eliminatedIds.length,
    summary: `Round ${nextRoundNum}: ${config.name} — ${result.eliminatedIds.length} eliminated, ${aliveBots.length - result.eliminatedIds.length} survive.`,
    challenge: result.challenge,
  };

  // Update bot performance stats from round results
  for (const p of result.participants) {
    const bot = bots.find((b) => b.id === p.bot_id);
    if (bot) {
      bot.cumulative_return = (bot.cumulative_return ?? 0) + (p.profit ?? 0);
      bot.total_matches += 1;
      if (p.survived) {
        bot.wins += 1;
        bot.survival_streak = (bot.survival_streak ?? 0) + 1;
      } else {
        bot.losses += 1;
        bot.survival_streak = 0;
      }
      bot.win_rate = bot.total_matches > 0 ? bot.wins / bot.total_matches : 0;
      if (p.optimal_delta !== undefined) {
        const prevTotal = (bot.accuracy ?? 0) * (bot.total_matches - 1);
        const score = Math.max(0, 100 - (p.optimal_delta * 2));
        bot.accuracy = (prevTotal + score) / bot.total_matches / 100;
        bot.optimal_deviation = Math.round(((bot.optimal_deviation ?? 0) * (bot.total_matches - 1) + p.optimal_delta) / bot.total_matches);
      }
    }
  }

  // Update eliminated bot statuses
  for (const elimId of result.eliminatedIds) {
    const bot = bots.find((b) => b.id === elimId);
    if (bot) {
      bot.season_status = "eliminated";
      bot.eliminated_in_round = nextRoundNum;
    }
  }

  season.rounds.push(round);
  season.current_round = nextRoundNum;
  season.alive_bots = aliveBots.length - result.eliminatedIds.length;

  // Check if season is over
  const survivors = bots.filter((b) => b.status === "active" && b.season_status === "alive");
  if (survivors.length <= 1 || nextRoundNum >= roundPlan.length) {
    season.status = "completed";
    season.ended_at = new Date().toISOString();
    if (survivors.length > 0) {
      season.champion_id = survivors[0].id;
      season.champion = survivors[0];
      survivors[0].season_status = "champion";
    }
  }

  calculateRanks();
  persistGlobal();
  return { season, round };
}

export function purchaseBot(botId: string): { success: boolean; bot?: Bot; error?: string } {
  initializeStore();
  const bot = bots.find((b) => b.id === botId);
  if (!bot) return { success: false, error: "Bot not found" };
  if (bot.status !== "active") return { success: false, error: "Bot is not available" };

  bot.status = "sold";
  bot.buyer_id = "demo-user";

  // Generate replacement
  const persona = generateBotPersona();
  const newBot: Bot = {
    id: generateId(),
    name: persona.name,
    type_label: persona.type_label,
    avatar_emoji: persona.avatar_emoji,
    created_at: new Date().toISOString(),
    alive_days: 0,
    win_rate: 0,
    total_matches: 0,
    wins: 0,
    losses: 0,
    rank: 0,
    status: "active",
    price: 5,
    hidden_persona: persona.hidden_persona,
    hidden_strategy: persona.hidden_strategy,
    hidden_background: persona.hidden_background,
    season_status: "alive",
    survival_streak: 0,
    betrayals: 0,
    cumulative_return: 0,
    accuracy: 0,
    optimal_deviation: 0,
  };
  bots.push(newBot);
  calculateRanks();
  persistGlobal();

  return { success: true, bot };
}

export function getStats() {
  initializeStore();
  const activeSeason = getActiveSeason();
  return {
    totalBots: bots.filter((b) => b.status === "active").length,
    aliveBots: bots.filter((b) => b.status === "active" && b.season_status === "alive").length,
    eliminatedBots: bots.filter((b) => b.season_status === "eliminated").length,
    totalSold: bots.filter((b) => b.status === "sold").length,
    currentSeason: activeSeason?.number ?? 0,
    currentRound: activeSeason?.current_round ?? 0,
    totalRounds: activeSeason?.total_rounds ?? 0,
  };
}
