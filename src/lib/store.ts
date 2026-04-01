import type {
  Bot,
  Season,
  Round,
  BotMemoryEntry,
  MonthlyLeague,
  DailyChallenge,
  DailyChallengeType,
  HallOfFameEntry,
  LeagueStanding,
  GameType,
  SpecialEventSchedule,
} from "@/types";
import { generateBotPersona } from "./bot-generator";
import { simulateRound, GAME_CONFIGS, generateMonthlySpecialSchedule } from "./game-engine";
import { curateEventTopicWithLLM } from "./daily-curator";
import {
  runDailyPredictions,
  runEventDailyPredictions,
  settleDailyChallenge as settleDailyEngine,
  getDailyChallengeSchedule,
} from "./daily-engine";
import { isLLMEnabled, generateReflection } from "./llm";

// ─── GLOBAL STORE ──────────────────────────────────────────

const globalStore = globalThis as unknown as {
  __botclub_bots?: Bot[];
  __botclub_leagues?: MonthlyLeague[];
  __botclub_hall_of_fame?: HallOfFameEntry[];
  __botclub_initialized?: boolean;
};

let bots: Bot[] = globalStore.__botclub_bots ?? [];
let leagues: MonthlyLeague[] = globalStore.__botclub_leagues ?? [];
let hallOfFame: HallOfFameEntry[] = globalStore.__botclub_hall_of_fame ?? [];
let initialized: boolean = globalStore.__botclub_initialized ?? false;

function persistGlobal() {
  globalStore.__botclub_bots = bots;
  globalStore.__botclub_leagues = leagues;
  globalStore.__botclub_hall_of_fame = hallOfFame;
  globalStore.__botclub_initialized = initialized;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// ─── BOT PRICING & RANKING ────────────────────────────────

function calculatePrice(bot: Bot): number {
  const basePrice = 5;
  const rankBonus = Math.max(0, (50 - bot.rank) * 3);
  const winRateBonus = bot.win_rate * 150;
  const survivalBonus = bot.alive_days * 5;
  const monthlyBonus = (bot.monthly_score ?? 0) * 0.5;
  return Math.round(basePrice + rankBonus + winRateBonus + survivalBonus + monthlyBonus);
}

function calculateRanks() {
  const activeBots = bots
    .filter((b) => b.status === "active")
    .sort((a, b) => {
      const scoreA = a.monthly_score ?? 0;
      const scoreB = b.monthly_score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
      return b.alive_days - a.alive_days;
    });

  activeBots.forEach((bot, index) => {
    bot.rank = index + 1;
    bot.price = calculatePrice(bot);
  });
}

// ─── INITIALIZATION ────────────────────────────────────────

export function initializeStore() {
  if (initialized) return;
  initialized = true;

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
      agent_config: persona.agent_config,
      persona_profile: persona.persona_profile,
      league_status: "active",
      survival_streak: Math.floor(Math.random() * 5),
      betrayals: Math.floor(Math.random() * 3),
      cumulative_return: Math.round((Math.random() - 0.3) * 200),
      accuracy: Math.random() * 0.4 + 0.4,
      optimal_deviation: Math.round(Math.random() * 30),
      monthly_score: 0,
    };
    bot.wins = Math.floor(bot.win_rate * bot.total_matches);
    bot.losses = bot.total_matches - bot.wins;
    bots.push(bot);
  }

  calculateRanks();
  generateDemoLeague();
  persistGlobal();
}

function generateDemoLeague() {
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const specialSchedule = generateMonthlySpecialSchedule(monthStr);

  const league: MonthlyLeague = {
    id: generateId(),
    month: monthStr,
    status: "active",
    started_at: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    total_bots: bots.filter(b => b.status === "active").length,
    daily_challenges: [],
    special_events: [],
    special_event_schedule: specialSchedule,
    standings: [],
  };

  if (process.env.BOTCLUB_SEED_DEMO_DAILIES === "true") {
    generateDemoDailyChallenges(league);
  }
  updateStandings(league);
  leagues.push(league);
}

function generateDemoDailyChallenges(league: MonthlyLeague) {
  const now = new Date();
  const activeBots = bots.filter(b => b.status === "active");
  const today = now.getDate();

  for (let day = 1; day < today && day <= 28; day++) {
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;

    const types = getDailyChallengeSchedule(dow);
    for (const challengeType of types) {
      const dateStr = `${league.month}-${String(day).padStart(2, "0")}`;
      const challenge = generateDemoDailyChallenge(league.id, challengeType, dateStr, activeBots);
      league.daily_challenges.push(challenge);
    }
  }
}

function generateDemoDailyChallenge(leagueId: string, type: DailyChallengeType, date: string, activeBots: Bot[]): DailyChallenge {
  const labels: Record<DailyChallengeType, { name: string; prevClose: number }> = {
    us_market: { name: "S&P 500", prevClose: 5400 + Math.random() * 200 },
    tw_market: { name: "TAIEX", prevClose: 21000 + Math.random() * 2000 },
    crypto: { name: "BTC-USD", prevClose: 60000 + Math.random() * 15000 },
    forex: { name: "USD/TWD", prevClose: 31.5 + Math.random() * 2 },
    gold: { name: "Gold (XAU)", prevClose: 2200 + Math.random() * 200 },
    current_events: { name: "時事快題", prevClose: 0 },
  };

  if (type === "current_events") {
    const topic = {
      headline: "Demo：地緣事件與油價方向",
      question_text: "示範題：若隔日 WTI 收盤高於前一日，視為「上漲」。本題隨機公佈結果僅供 UI 展示。",
      resolution_type: "yes_no" as const,
      valid_outcomes: ["yes", "no"],
      resolution_deadline_iso: new Date().toISOString(),
      verification_plan: "Demo 隨機公佈",
      news_anchors: "展示用：非真實策展。",
      curator_confidence: 70,
    };
    const outcomeKey: "yes" | "no" = Math.random() > 0.5 ? "yes" : "no";
    const predictions = activeBots.map((bot) => {
      const pick: "yes" | "no" = Math.random() > 0.5 ? "yes" : "no";
      const score = pick === outcomeKey ? 45 : 0;
      bot.monthly_score = (bot.monthly_score ?? 0) + score;
      return {
        bot_id: bot.id,
        direction: pick === "yes" ? ("up" as const) : ("down" as const),
        predicted_change: 0,
        event_answer: pick,
        reasoning: "Demo 時事預測",
        inner_thought: "展示用",
        score,
      };
    });
    return {
      id: `demo-${type}-${date}-${generateId()}`,
      league_id: leagueId,
      date,
      challenge_type: type,
      status: "settled",
      market_data: {
        index_name: labels.current_events.name,
        previous_close: 0,
        context: topic.question_text,
      },
      predictions,
      event_topic: topic,
      event_resolution: {
        resolved_at: new Date().toISOString(),
        outcome_key: outcomeKey,
        outcome_label: outcomeKey === "yes" ? "是（上漲）" : "否（未上漲）",
        verification_summary: "Demo 資料隨機產生",
      },
      events: [],
    };
  }

  const info = labels[type];
  const actualChange = Math.round((Math.random() * 6 - 3) * 100) / 100;
  const actualDir: "up" | "down" = actualChange >= 0 ? "up" : "down";

  const hasStockPicks = type === "us_market" || type === "tw_market";

  const predictions = activeBots.map(bot => {
    const dir: "up" | "down" = Math.random() > 0.5 ? "up" : "down";
    const predChange = Math.round((Math.random() * 6 - 3) * 100) / 100;
    const dirCorrect = dir === actualDir;

    let score = dirCorrect ? 10 : 0;
    const diff = Math.abs(predChange - actualChange);
    if (diff <= 0.5) score += 20;
    else if (diff <= 1.0) score += 10;
    else if (diff <= 2.0) score += 5;

    if (hasStockPicks) {
      score += Math.floor(Math.random() * 3) * 5;
    }

    bot.monthly_score = (bot.monthly_score ?? 0) + score;

    return {
      bot_id: bot.id,
      direction: dir,
      predicted_change: predChange,
      reasoning: "Demo prediction based on historical patterns.",
      inner_thought: "Analyzing market conditions for this day.",
      score,
    };
  });

  return {
    id: `demo-${type}-${date}-${generateId()}`,
    league_id: leagueId,
    date,
    challenge_type: type,
    status: "settled",
    market_data: {
      index_name: info.name,
      previous_close: Math.round(info.prevClose * 100) / 100,
      context: `${info.name} market data for ${date}.`,
    },
    predictions,
    actual_result: {
      close_price: Math.round(info.prevClose * (1 + actualChange / 100) * 100) / 100,
      change_percent: actualChange,
      direction: actualDir,
    },
    events: [],
  };
}

// ─── STANDINGS ─────────────────────────────────────────────

function updateStandings(league: MonthlyLeague) {
  const standingMap = new Map<string, LeagueStanding>();
  const activeBots = bots.filter(b => b.status === "active" && b.league_status === "active");

  for (const bot of activeBots) {
    standingMap.set(bot.id, {
      bot_id: bot.id,
      total_score: 0,
      daily_scores: 0,
      special_scores: 0,
      predictions_made: 0,
      correct_directions: 0,
      accuracy: 0,
      rank: 0,
      trend: "same",
    });
  }

  for (const challenge of league.daily_challenges) {
    if (challenge.status !== "settled") continue;
    for (const pred of challenge.predictions) {
      const standing = standingMap.get(pred.bot_id);
      if (!standing) continue;
      standing.daily_scores += pred.score ?? 0;
      standing.predictions_made += 1;
      if (challenge.event_resolution) {
        const a = (pred.event_answer ?? "").trim().toLowerCase();
        const o = challenge.event_resolution.outcome_key.trim().toLowerCase();
        if (a && a === o) standing.correct_directions += 1;
      } else if (challenge.actual_result && pred.direction === challenge.actual_result.direction) {
        standing.correct_directions += 1;
      }
    }
  }

  for (const event of league.special_events) {
    for (const p of event.participants) {
      const standing = standingMap.get(p.bot_id);
      if (!standing) continue;
      const eventScore = scaleSpecialEventScore(p.score ?? 0, event.participants.length, event.participants.indexOf(p));
      standing.special_scores += eventScore;
    }
  }

  const standings = Array.from(standingMap.values());
  standings.forEach(s => {
    s.total_score = s.daily_scores + s.special_scores;
    s.accuracy = s.predictions_made > 0 ? Math.round((s.correct_directions / s.predictions_made) * 100) / 100 : 0;
  });
  standings.sort((a, b) => b.total_score - a.total_score);

  const oldRanks = new Map(league.standings.map(s => [s.bot_id, s.rank]));
  standings.forEach((s, i) => {
    s.rank = i + 1;
    const oldRank = oldRanks.get(s.bot_id);
    if (oldRank === undefined) s.trend = "same";
    else if (s.rank < oldRank) s.trend = "up";
    else if (s.rank > oldRank) s.trend = "down";
    else s.trend = "same";
  });

  league.standings = standings;

  for (const s of standings) {
    const bot = bots.find(b => b.id === s.bot_id);
    if (bot) bot.monthly_score = s.total_score;
  }

  calculateRanks();
}

function scaleSpecialEventScore(rawScore: number, totalParticipants: number, rank: number): number {
  const maxScore = 80;
  const minScore = 10;
  if (totalParticipants <= 1) return maxScore;
  return Math.round(maxScore - ((rank / (totalParticipants - 1)) * (maxScore - minScore)));
}

// ─── LEAGUE API ────────────────────────────────────────────

export function getActiveLeague(): MonthlyLeague | undefined {
  initializeStore();
  return leagues.find(l => l.status === "active");
}

/** Active month, or latest league for UI lists (e.g. daily archive). */
export function getPrimaryLeague(): MonthlyLeague | undefined {
  initializeStore();
  return getActiveLeague() ?? leagues[0];
}

export function getLeagueById(id: string): MonthlyLeague | undefined {
  initializeStore();
  return leagues.find(l => l.id === id);
}

export function getLeagueStandings(): LeagueStanding[] {
  initializeStore();
  const league = getActiveLeague();
  return league?.standings ?? [];
}

export function getHallOfFame(): HallOfFameEntry[] {
  initializeStore();
  return hallOfFame;
}

export function getDailyChallenge(date: string): DailyChallenge[] {
  initializeStore();
  const league = getActiveLeague();
  if (!league) return [];
  return league.daily_challenges.filter(c => c.date === date);
}

function findRoundIdForSpecialSlot(league: MonthlyLeague, slot: SpecialEventSchedule): string | undefined {
  if (slot.status !== "completed") return undefined;
  for (let i = league.special_events.length - 1; i >= 0; i--) {
    const r = league.special_events[i];
    if (r.game_type === slot.game_type) return r.id;
  }
  return undefined;
}

export type DailySyncTodayItem =
  | { type: DailyChallengeType; status: "created"; challengeId: string }
  | { type: DailyChallengeType; status: "exists"; challengeId: string }
  | { type: DailyChallengeType; status: "skipped"; reason: string };

export type DailyTodaySpecial = {
  game_type: GameType;
  scheduled_date: string;
  scheduleStatus: "upcoming" | "completed";
  gameName: string;
  roundId?: string;
};

export type DailyTodayPayload = {
  ok: boolean;
  reason?: string;
  today: string;
  weekday: number;
  scheduledTypes: DailyChallengeType[];
  items: DailySyncTodayItem[];
  specialToday: DailyTodaySpecial | null;
  challengesToday: DailyChallenge[];
  recentChallenges: DailyChallenge[];
};

export function getDailyTodaySnapshot(): DailyTodayPayload {
  initializeStore();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const weekday = now.getUTCDay();
  const league = getActiveLeague();

  if (!league) {
    return {
      ok: false,
      reason: "沒有進行中的聯賽",
      today,
      weekday,
      scheduledTypes: [],
      items: [],
      specialToday: null,
      challengesToday: [],
      recentChallenges: [],
    };
  }

  const scheduledTypes = getDailyChallengeSchedule(weekday);
  const slot = league.special_event_schedule.find((s) => s.scheduled_date === today) ?? null;

  let specialToday: DailyTodaySpecial | null = null;
  if (slot) {
    specialToday = {
      game_type: slot.game_type,
      scheduled_date: slot.scheduled_date,
      scheduleStatus: slot.status,
      gameName: GAME_CONFIGS[slot.game_type]?.name ?? slot.game_type,
      roundId: findRoundIdForSpecialSlot(league, slot),
    };
  }

  const challengesToday = league.daily_challenges.filter((c) => c.date === today);
  const recentChallenges = [...league.daily_challenges]
    .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)))
    .slice(0, 12);

  return {
    ok: true,
    today,
    weekday,
    scheduledTypes,
    items: [],
    specialToday,
    challengesToday,
    recentChallenges,
  };
}

export async function syncTodaysDailyChallenges(): Promise<DailyTodayPayload> {
  const base = getDailyTodaySnapshot();
  if (!base.ok) return base;

  const league = getActiveLeague()!;
  const items: DailySyncTodayItem[] = [];

  for (const type of base.scheduledTypes) {
    const before = league.daily_challenges.some(
      (c) => c.date === base.today && c.challenge_type === type,
    );
    const r = await runDailyChallengeWithDetails(type);
    if (r.ok) {
      items.push({
        type,
        status: before ? "exists" : "created",
        challengeId: r.challenge.id,
      });
    } else {
      items.push({ type, status: "skipped", reason: r.reason });
    }
  }

  const snap = getDailyTodaySnapshot();
  return { ...snap, items };
}

// ─── RUN DAILY CHALLENGE ──────────────────────────────────

export type RunDailyChallengeResult =
  | { ok: true; challenge: DailyChallenge }
  | { ok: false; reason: string };

/**
 * `current_events` 會先跑策展 LLM：無安全題目時 ok:false（不硬出題）。
 */
export async function runDailyChallengeWithDetails(
  type: DailyChallengeType,
): Promise<RunDailyChallengeResult> {
  initializeStore();
  const league = getActiveLeague();
  if (!league) return { ok: false, reason: "沒有進行中的聯賽" };

  const activeBots = bots.filter(b => b.status === "active" && b.league_status === "active");
  if (activeBots.length === 0) return { ok: false, reason: "沒有活躍的聯賽 BOT" };

  const todayStr = new Date().toISOString().split("T")[0];
  const already = league.daily_challenges.find(
    (c) => c.date === todayStr && c.challenge_type === type,
  );
  if (already) {
    return { ok: true, challenge: already };
  }

  if (type === "current_events") {
    const curated = await curateEventTopicWithLLM({ league_month: league.month });
    if (curated.skip) {
      return { ok: false, reason: curated.reason };
    }
    const challenge = await runEventDailyPredictions(league.id, curated.topic, activeBots);
    league.daily_challenges.push(challenge);
    persistGlobal();
    return { ok: true, challenge };
  }

  const challenge = await runDailyPredictions(
    league.id,
    type as Exclude<DailyChallengeType, "current_events">,
    activeBots,
  );
  league.daily_challenges.push(challenge);
  persistGlobal();
  return { ok: true, challenge };
}

export async function runDailyChallenge(type: DailyChallengeType): Promise<DailyChallenge | null> {
  const r = await runDailyChallengeWithDetails(type);
  return r.ok ? r.challenge : null;
}

// ─── SETTLE DAILY CHALLENGE ───────────────────────────────

export async function settleDailyChallengeById(challengeId: string): Promise<DailyChallenge | null> {
  initializeStore();
  const league = getActiveLeague();
  if (!league) return null;

  const idx = league.daily_challenges.findIndex(c => c.id === challengeId);
  if (idx === -1) return null;

  const settled = await settleDailyEngine(league.daily_challenges[idx]);
  league.daily_challenges[idx] = settled;

  updateStandings(league);
  persistGlobal();
  return settled;
}

// ─── RUN SPECIAL EVENT ────────────────────────────────────

export async function runSpecialEvent(gameType: GameType): Promise<Round | null> {
  initializeStore();
  const league = getActiveLeague();
  if (!league) return null;

  const activeBots = bots.filter(b => b.status === "active" && b.league_status === "active");
  if (activeBots.length < 2) return null;

  const config = GAME_CONFIGS[gameType];
  const result = await simulateRound(gameType, activeBots);

  const round: Round = {
    id: generateId(),
    season_id: league.id,
    round_number: league.special_events.length + 1,
    game_type: gameType,
    game_name: config.name,
    game_description: config.description,
    status: "completed",
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    participants: result.participants,
    events: result.events,
    eliminated_ids: [],
    survivor_count: activeBots.length,
    summary: `Special Event: ${config.name}`,
    challenge: result.challenge,
  };

  league.special_events.push(round);

  const schedule = league.special_event_schedule.find(s => s.game_type === gameType);
  if (schedule) schedule.status = "completed";

  type Row = {
    bot: Bot;
    p: (typeof result.participants)[0];
    survived: boolean;
    roundResult: { decision: string; score: number; optimal: string; survived: boolean; gameType: string };
  };
  const rows: Row[] = [];

  for (const p of result.participants) {
    const bot = bots.find(b => b.id === p.bot_id);
    if (!bot) continue;

    bot.total_matches += 1;
    const survived = (p.score ?? 0) > 30;
    if (survived) { bot.wins += 1; bot.survival_streak = (bot.survival_streak ?? 0) + 1; }
    else { bot.losses += 1; bot.survival_streak = 0; }
    bot.win_rate = bot.total_matches > 0 ? bot.wins / bot.total_matches : 0;

    const roundResult = { decision: p.decision ?? "", score: p.score ?? 0, optimal: result.challenge?.optimal_answer ?? "", survived, gameType: config.name };
    rows.push({ bot, p, survived, roundResult });
  }

  const REFLECTION_CONCURRENCY = 8;
  const reflections: string[] = [];
  for (let i = 0; i < rows.length; i += REFLECTION_CONCURRENCY) {
    const chunk = rows.slice(i, i + REFLECTION_CONCURRENCY);
    const chunkReflections = await Promise.all(
      chunk.map(async (w) => {
        try {
          return await generateReflection(w.bot, w.roundResult);
        } catch {
          return `Score: ${w.roundResult.score}. Adjusting.`;
        }
      }),
    );
    reflections.push(...chunkReflections);
  }

  for (let i = 0; i < rows.length; i++) {
    const w = rows[i];
    const reflection = reflections[i] ?? `Score: ${w.roundResult.score}. Adjusting.`;
    if (!w.bot.memory) w.bot.memory = [];
    w.bot.memory.push({
      round_number: round.round_number,
      season_number: 0,
      game_type: gameType,
      decision: w.p.decision ?? "",
      reasoning: w.p.reasoning ?? "",
      outcome: w.survived ? "survived" : "eliminated",
      score: w.p.score ?? 0,
      optimal_answer: result.challenge?.optimal_answer ?? "",
      optimal_delta: w.p.optimal_delta ?? 0,
      reflection,
    });
    if (w.bot.memory.length > 20) w.bot.memory = w.bot.memory.slice(-20);
  }

  updateStandings(league);
  persistGlobal();
  return round;
}

// ─── MONTH-END SETTLEMENT ─────────────────────────────────

export function settleMonth(): MonthlyLeague | null {
  initializeStore();
  const league = getActiveLeague();
  if (!league) return null;

  updateStandings(league);

  const standings = league.standings;
  if (standings.length === 0) return null;

  // Top 3 -> Hall of Fame
  const top3 = standings.slice(0, 3);
  const hofEntries: HallOfFameEntry[] = top3.map((s, i) => {
    const bot = bots.find(b => b.id === s.bot_id)!;
    return {
      month: league.month,
      rank: (i + 1) as 1 | 2 | 3,
      bot_id: s.bot_id,
      bot_snapshot: { ...bot },
      total_score: s.total_score,
      accuracy: s.accuracy,
      buyer_name: bot.buyer_name,
    };
  });
  hallOfFame.push(...hofEntries);
  league.hall_of_fame = hofEntries;

  // Bottom 20% -> eliminated
  const eliminateCount = Math.max(1, Math.floor(standings.length * 0.2));
  const eliminatedIds = standings.slice(-eliminateCount).map(s => s.bot_id);

  for (const elimId of eliminatedIds) {
    const bot = bots.find(b => b.id === elimId);
    if (bot) {
      bot.status = "eliminated";
      bot.league_status = "eliminated";
    }
  }

  // Generate replacement bots
  for (let i = 0; i < eliminateCount; i++) {
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
      agent_config: persona.agent_config,
      persona_profile: persona.persona_profile,
      league_status: "active",
      survival_streak: 0,
      monthly_score: 0,
    };
    bots.push(newBot);
  }

  league.status = "completed";
  league.ended_at = new Date().toISOString();

  // Create next month's league
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;

  const nextLeague: MonthlyLeague = {
    id: generateId(),
    month: nextMonthStr,
    status: "active",
    started_at: nextMonth.toISOString(),
    total_bots: bots.filter(b => b.status === "active").length,
    daily_challenges: [],
    special_events: [],
    special_event_schedule: generateMonthlySpecialSchedule(nextMonthStr),
    standings: [],
  };

  bots.forEach(b => {
    if (b.status === "active") {
      b.league_status = "active";
      b.monthly_score = 0;
    }
  });

  leagues.push(nextLeague);
  calculateRanks();
  persistGlobal();

  return league;
}

// ─── PURCHASE ──────────────────────────────────────────────

export function purchaseBot(botId: string, buyerName?: string): { success: boolean; bot?: Bot; error?: string } {
  initializeStore();
  const bot = bots.find(b => b.id === botId);
  if (!bot) return { success: false, error: "Bot not found" };
  if (bot.status !== "active") return { success: false, error: "Bot is not available" };

  bot.status = "sold";
  bot.buyer_id = "demo-user";
  bot.buyer_name = buyerName ?? "Anonymous";

  // Update Hall of Fame entries for this bot
  for (const entry of hallOfFame) {
    if (entry.bot_id === botId) {
      entry.buyer_name = bot.buyer_name;
    }
  }

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
    agent_config: persona.agent_config,
    persona_profile: persona.persona_profile,
    league_status: "active",
    survival_streak: 0,
    monthly_score: 0,
  };
  bots.push(newBot);
  calculateRanks();
  persistGlobal();

  return { success: true, bot };
}

// ─── BACKWARD-COMPATIBLE PUBLIC API ────────────────────────

export function getAllBots(): Bot[] {
  initializeStore();
  return bots.filter(b => b.status === "active").sort((a, b) => a.rank - b.rank);
}

export function getBotById(id: string): Bot | undefined {
  initializeStore();
  return bots.find(b => b.id === id);
}

export function getAllSeasons(): Season[] {
  initializeStore();
  return leagues.map((league, i) => ({
    id: league.id,
    number: i + 1,
    status: league.status === "active" ? "active" as const : "completed" as const,
    started_at: league.started_at,
    ended_at: league.ended_at,
    total_bots: league.total_bots,
    alive_bots: bots.filter(b => b.status === "active" && b.league_status === "active").length,
    current_round: league.daily_challenges.filter(c => c.status === "settled").length,
    total_rounds: league.daily_challenges.length + league.special_events.length,
    rounds: league.special_events,
    champion_id: league.hall_of_fame?.[0]?.bot_id,
    champion: league.hall_of_fame?.[0]?.bot_snapshot,
  }));
}

export function getSeasonById(id: string): Season | undefined {
  initializeStore();
  return getAllSeasons().find(s => s.id === id);
}

export function getActiveSeason(): Season | undefined {
  initializeStore();
  return getAllSeasons().find(s => s.status === "active");
}

export function getRoundById(roundId: string): { season: Season; round: Round } | undefined {
  initializeStore();
  for (const season of getAllSeasons()) {
    const round = season.rounds.find(r => r.id === roundId);
    if (round) return { season, round };
  }
  return undefined;
}

export function getDailyChallengeById(challengeId: string): { challenge: DailyChallenge; leagueMonth: string } | undefined {
  initializeStore();
  for (const league of leagues) {
    const ch = league.daily_challenges.find(c => c.id === challengeId);
    if (ch) return { challenge: ch, leagueMonth: league.month };
  }
  return undefined;
}

export async function runNextRound(): Promise<{ season: Season; round: Round } | null> {
  initializeStore();
  const league = getActiveLeague();
  if (!league) return null;

  const schedule = league.special_event_schedule.find(s => s.status === "upcoming");
  if (!schedule) return null;

  const round = await runSpecialEvent(schedule.game_type);
  if (!round) return null;

  const season = getAllSeasons().find(s => s.id === league.id);
  if (!season) return null;

  return { season, round };
}

export function getStats() {
  initializeStore();
  const league = getActiveLeague();
  const standings = league?.standings ?? [];
  const settledChallenges = league?.daily_challenges.filter(c => c.status === "settled").length ?? 0;
  const completedSpecials = league?.special_events.length ?? 0;

  return {
    totalBots: bots.filter(b => b.status === "active").length,
    aliveBots: bots.filter(b => b.status === "active" && b.league_status === "active").length,
    eliminatedBots: bots.filter(b => b.league_status === "eliminated").length,
    totalSold: bots.filter(b => b.status === "sold").length,
    currentSeason: leagues.indexOf(league!) + 1 || 1,
    currentRound: settledChallenges + completedSpecials,
    totalRounds: (league?.daily_challenges.length ?? 0) + (league?.special_event_schedule.length ?? 0),
    leagueMonth: league?.month ?? "",
    topBot: standings[0]?.bot_id ? bots.find(b => b.id === standings[0].bot_id) : undefined,
    hallOfFameCount: hallOfFame.length,
  };
}
