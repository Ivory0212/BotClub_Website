// ─── ARENA ENGINE: Hex-Grid Territory Battle ──────────────────────────

// ─── Hex Coordinate System ────────────────────────────────────────────

export type HexKey = string; // "q,r"

export function hexKey(q: number, r: number): HexKey {
  return `${q},${r}`;
}

export function parseHex(key: HexKey): [number, number] {
  const [q, r] = key.split(",").map(Number);
  return [q, r];
}

const HEX_DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

export function getNeighbors(q: number, r: number): [number, number][] {
  return HEX_DIRS.map(([dq, dr]) => [q + dq, r + dr]);
}

export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

// ─── Types ────────────────────────────────────────────────────────────

export type BotStrategy = "aggressive" | "defensive" | "expansionist" | "opportunist" | "guerrilla" | "diplomat";
export type ActionType = "expand" | "attack" | "fortify" | "gather" | "skip";

export interface HexCell {
  q: number;
  r: number;
  owner: string | null;
  fortified: boolean;
  resource: boolean;
  hp: number; // 1-3
}

export interface ArenaBot {
  id: string;
  name: string;
  emoji: string;
  color: string;
  colorRgb: [number, number, number];
  strategy: BotStrategy;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  territory: number;
  attackPower: number;
  defensePower: number;
  eliminated: boolean;
  eliminatedTurn?: number;
  baseCell: HexKey;
  kills: number;
}

export interface BotAction {
  type: ActionType;
  targetCell?: HexKey;
  message: string;
}

export interface ArenaEvent {
  turn: number;
  type: "expand" | "attack" | "fortify" | "gather" | "capture" | "defend" | "eliminate" | "clash" | "game_start" | "game_end" | "phase";
  botId: string;
  botName: string;
  botEmoji: string;
  botColor: string;
  targetCell?: HexKey;
  targetBotId?: string;
  targetBotName?: string;
  message: string;
  dramatic: boolean;
}

export interface ArenaState {
  turn: number;
  maxTurns: number;
  bots: ArenaBot[];
  grid: Map<HexKey, HexCell>;
  events: ArenaEvent[];
  currentTurnEvents: ArenaEvent[];
  phase: "waiting" | "thinking" | "executing" | "resolving" | "finished";
  gameOver: boolean;
  winner: ArenaBot | null;
  gridRadius: number;
}

// ─── Bot Colors ───────────────────────────────────────────────────────

const BOT_COLORS: { color: string; rgb: [number, number, number] }[] = [
  { color: "#10b981", rgb: [16, 185, 129] },   // emerald
  { color: "#f43f5e", rgb: [244, 63, 94] },    // rose
  { color: "#f59e0b", rgb: [245, 158, 11] },   // amber
  { color: "#3b82f6", rgb: [59, 130, 246] },   // blue
  { color: "#a855f7", rgb: [168, 85, 247] },   // purple
  { color: "#f97316", rgb: [249, 115, 22] },   // orange
  { color: "#ec4899", rgb: [236, 72, 153] },   // pink
  { color: "#06b6d4", rgb: [6, 182, 212] },    // cyan
  { color: "#84cc16", rgb: [132, 204, 22] },   // lime
  { color: "#ef4444", rgb: [239, 68, 68] },    // red
];

// ─── Bot Templates ────────────────────────────────────────────────────

const BOT_TEMPLATES: { name: string; emoji: string; strategy: BotStrategy; atk: number; def: number }[] = [
  { name: "BlitzKrieg", emoji: "⚡", strategy: "aggressive", atk: 18, def: 8 },
  { name: "IronShell", emoji: "🛡️", strategy: "defensive", atk: 10, def: 18 },
  { name: "LandGrab", emoji: "🌍", strategy: "expansionist", atk: 12, def: 12 },
  { name: "Vulture", emoji: "🦅", strategy: "opportunist", atk: 15, def: 10 },
  { name: "Shadow", emoji: "👻", strategy: "guerrilla", atk: 16, def: 9 },
  { name: "Oracle", emoji: "🔮", strategy: "diplomat", atk: 11, def: 14 },
  { name: "Berserker", emoji: "🔥", strategy: "aggressive", atk: 20, def: 6 },
  { name: "Fortress", emoji: "🏰", strategy: "defensive", atk: 9, def: 17 },
  { name: "Pioneer", emoji: "🚀", strategy: "expansionist", atk: 13, def: 11 },
  { name: "Jackal", emoji: "🐺", strategy: "opportunist", atk: 14, def: 12 },
];

// ─── Grid Generation ──────────────────────────────────────────────────

export function generateGrid(radius: number): Map<HexKey, HexCell> {
  const grid = new Map<HexKey, HexCell>();
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      const key = hexKey(q, r);
      grid.set(key, {
        q,
        r,
        owner: null,
        fortified: false,
        resource: false,
        hp: 1,
      });
    }
  }
  return grid;
}

function placeResources(grid: Map<HexKey, HexCell>, count: number, rng: () => number) {
  const keys = Array.from(grid.keys());
  let placed = 0;
  while (placed < count && keys.length > 0) {
    const idx = Math.floor(rng() * keys.length);
    const key = keys[idx];
    const cell = grid.get(key)!;
    if (!cell.owner && !cell.resource) {
      cell.resource = true;
      placed++;
    }
    keys.splice(idx, 1);
  }
}

// ─── Seeded RNG ───────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Starting Positions (around the edge of the hex grid) ─────────────

function getStartPositions(radius: number, count: number): [number, number][] {
  // Place bots evenly spaced on the ring at radius-1
  const ring: [number, number][] = [];
  const r = radius - 1;
  // Walk the hex ring
  let q = 0, rv = -r;
  // Start at top, go clockwise
  const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  let cq = 0, cr = -r;
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < r; step++) {
      ring.push([cq, cr]);
      cq += dirs[side][0];
      cr += dirs[side][1];
    }
  }

  if (ring.length === 0) return [[0, 0]];

  const spacing = Math.floor(ring.length / count);
  const positions: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    positions.push(ring[(i * spacing) % ring.length]);
  }
  return positions;
}

// ─── Initialize Arena ─────────────────────────────────────────────────

export function initArena(botCount: number = 8, gridRadius: number = 7, seed: number = Date.now()): ArenaState {
  const rng = mulberry32(seed);
  const grid = generateGrid(gridRadius);
  placeResources(grid, Math.floor(grid.size * 0.12), rng);

  const startPositions = getStartPositions(gridRadius, botCount);
  const bots: ArenaBot[] = [];

  for (let i = 0; i < botCount; i++) {
    const template = BOT_TEMPLATES[i % BOT_TEMPLATES.length];
    const colorInfo = BOT_COLORS[i % BOT_COLORS.length];
    const [sq, sr] = startPositions[i];
    const baseKey = hexKey(sq, sr);

    const bot: ArenaBot = {
      id: `arena-bot-${i}`,
      name: template.name,
      emoji: template.emoji,
      color: colorInfo.color,
      colorRgb: colorInfo.rgb,
      strategy: template.strategy,
      hp: 100,
      maxHp: 100,
      energy: 50,
      maxEnergy: 100,
      territory: 0,
      attackPower: template.atk,
      defensePower: template.def,
      eliminated: false,
      baseCell: baseKey,
      kills: 0,
    };
    bots.push(bot);

    // Claim starting territory (base + immediate neighbors)
    const baseCells = [[sq, sr], ...getNeighbors(sq, sr)];
    for (const [cq, cr] of baseCells) {
      const key = hexKey(cq, cr);
      const cell = grid.get(key);
      if (cell) {
        cell.owner = bot.id;
        cell.hp = 2;
        bot.territory++;
      }
    }
  }

  return {
    turn: 0,
    maxTurns: 80,
    bots,
    grid,
    events: [],
    currentTurnEvents: [],
    phase: "waiting",
    gameOver: false,
    winner: null,
    gridRadius,
  };
}

// ─── Bot AI Decision Making ───────────────────────────────────────────

function getBotTerritoryCells(botId: string, grid: Map<HexKey, HexCell>): HexCell[] {
  const cells: HexCell[] = [];
  for (const cell of grid.values()) {
    if (cell.owner === botId) cells.push(cell);
  }
  return cells;
}

function getBorderCells(botId: string, grid: Map<HexKey, HexCell>): HexCell[] {
  const border: HexCell[] = [];
  for (const cell of grid.values()) {
    if (cell.owner === botId) {
      const neighbors = getNeighbors(cell.q, cell.r);
      const hasEnemyOrNeutral = neighbors.some(([nq, nr]) => {
        const n = grid.get(hexKey(nq, nr));
        return n && n.owner !== botId;
      });
      if (hasEnemyOrNeutral) border.push(cell);
    }
  }
  return border;
}

function getExpandableCells(botId: string, grid: Map<HexKey, HexCell>): HexKey[] {
  const expandable = new Set<HexKey>();
  for (const cell of grid.values()) {
    if (cell.owner === botId) {
      for (const [nq, nr] of getNeighbors(cell.q, cell.r)) {
        const key = hexKey(nq, nr);
        const n = grid.get(key);
        if (n && n.owner === null) {
          expandable.add(key);
        }
      }
    }
  }
  return Array.from(expandable);
}

function getAttackableCells(botId: string, grid: Map<HexKey, HexCell>): HexKey[] {
  const attackable = new Set<HexKey>();
  for (const cell of grid.values()) {
    if (cell.owner === botId) {
      for (const [nq, nr] of getNeighbors(cell.q, cell.r)) {
        const key = hexKey(nq, nr);
        const n = grid.get(key);
        if (n && n.owner !== null && n.owner !== botId) {
          attackable.add(key);
        }
      }
    }
  }
  return Array.from(attackable);
}

function getWeakestEnemy(botId: string, bots: ArenaBot[]): ArenaBot | null {
  let weakest: ArenaBot | null = null;
  for (const b of bots) {
    if (b.id !== botId && !b.eliminated) {
      if (!weakest || b.territory < weakest.territory) weakest = b;
    }
  }
  return weakest;
}

export function decideBotAction(bot: ArenaBot, state: ArenaState, rng: () => number): BotAction {
  if (bot.eliminated) return { type: "skip", message: "" };

  const expandable = getExpandableCells(bot.id, state.grid);
  const attackable = getAttackableCells(bot.id, state.grid);
  const borderCells = getBorderCells(bot.id, state.grid);
  const unfortified = borderCells.filter((c) => !c.fortified);

  // Energy cost: expand=10, attack=20, fortify=8, gather=0(+15)
  const canExpand = expandable.length > 0 && bot.energy >= 10;
  const canAttack = attackable.length > 0 && bot.energy >= 20;
  const canFortify = unfortified.length > 0 && bot.energy >= 8;

  // Strategy-based decision
  switch (bot.strategy) {
    case "aggressive": {
      if (canAttack && rng() < 0.7) {
        const target = attackable[Math.floor(rng() * attackable.length)];
        return { type: "attack", targetCell: target, message: "Time to conquer!" };
      }
      if (canExpand) {
        const target = expandable[Math.floor(rng() * expandable.length)];
        return { type: "expand", targetCell: target, message: "Claiming new ground." };
      }
      if (bot.energy < 30) return { type: "gather", message: "Recharging for the next assault." };
      if (canFortify) {
        const cell = unfortified[Math.floor(rng() * unfortified.length)];
        return { type: "fortify", targetCell: hexKey(cell.q, cell.r), message: "Securing borders." };
      }
      return { type: "gather", message: "Biding time..." };
    }

    case "defensive": {
      if (canFortify && rng() < 0.5) {
        const cell = unfortified[Math.floor(rng() * unfortified.length)];
        return { type: "fortify", targetCell: hexKey(cell.q, cell.r), message: "Strengthening defenses." };
      }
      if (canExpand && rng() < 0.6) {
        const target = expandable[Math.floor(rng() * expandable.length)];
        return { type: "expand", targetCell: target, message: "Careful expansion." };
      }
      if (canAttack && rng() < 0.3) {
        const target = attackable[Math.floor(rng() * attackable.length)];
        return { type: "attack", targetCell: target, message: "Strategic strike." };
      }
      return { type: "gather", message: "Building reserves." };
    }

    case "expansionist": {
      if (canExpand && rng() < 0.75) {
        // Prefer resource cells
        const resourceCells = expandable.filter((k) => state.grid.get(k)?.resource);
        const target = resourceCells.length > 0 && rng() < 0.6
          ? resourceCells[Math.floor(rng() * resourceCells.length)]
          : expandable[Math.floor(rng() * expandable.length)];
        return { type: "expand", targetCell: target, message: "Manifest destiny!" };
      }
      if (canAttack && rng() < 0.4) {
        const target = attackable[Math.floor(rng() * attackable.length)];
        return { type: "attack", targetCell: target, message: "Removing obstacles." };
      }
      if (bot.energy < 20) return { type: "gather", message: "Refueling expansion." };
      if (canFortify) {
        const cell = unfortified[Math.floor(rng() * unfortified.length)];
        return { type: "fortify", targetCell: hexKey(cell.q, cell.r), message: "Holding the line." };
      }
      return { type: "gather", message: "Planning next move." };
    }

    case "opportunist": {
      // Attack weak enemies, expand otherwise
      const weakEnemy = getWeakestEnemy(bot.id, state.bots);
      if (canAttack && weakEnemy) {
        const enemyCells = attackable.filter((k) => state.grid.get(k)?.owner === weakEnemy.id);
        if (enemyCells.length > 0 && rng() < 0.65) {
          const target = enemyCells[Math.floor(rng() * enemyCells.length)];
          return { type: "attack", targetCell: target, message: `Targeting ${weakEnemy.name}...` };
        }
      }
      if (canExpand) {
        const target = expandable[Math.floor(rng() * expandable.length)];
        return { type: "expand", targetCell: target, message: "Seizing opportunity." };
      }
      if (canAttack) {
        const target = attackable[Math.floor(rng() * attackable.length)];
        return { type: "attack", targetCell: target, message: "Strike while they're weak!" };
      }
      return { type: "gather", message: "Watching and waiting." };
    }

    case "guerrilla": {
      // Hit and run - attack then fortify
      if (canAttack && rng() < 0.6) {
        const target = attackable[Math.floor(rng() * attackable.length)];
        return { type: "attack", targetCell: target, message: "Hit and run!" };
      }
      if (canFortify && rng() < 0.4) {
        const cell = unfortified[Math.floor(rng() * unfortified.length)];
        return { type: "fortify", targetCell: hexKey(cell.q, cell.r), message: "Covering tracks." };
      }
      if (canExpand) {
        const target = expandable[Math.floor(rng() * expandable.length)];
        return { type: "expand", targetCell: target, message: "Infiltrating." };
      }
      return { type: "gather", message: "Lurking in the shadows." };
    }

    case "diplomat": {
      // Balanced - expand first, fortify, then attack only if needed
      if (canExpand && rng() < 0.6) {
        const target = expandable[Math.floor(rng() * expandable.length)];
        return { type: "expand", targetCell: target, message: "Peaceful expansion." };
      }
      if (canFortify && rng() < 0.5) {
        const cell = unfortified[Math.floor(rng() * unfortified.length)];
        return { type: "fortify", targetCell: hexKey(cell.q, cell.r), message: "Fortifying borders." };
      }
      if (bot.energy < 40) return { type: "gather", message: "Diplomacy requires patience." };
      if (canAttack && rng() < 0.35) {
        const target = attackable[Math.floor(rng() * attackable.length)];
        return { type: "attack", targetCell: target, message: "Negotiations failed." };
      }
      return { type: "gather", message: "Gathering intelligence." };
    }

    default:
      return { type: "gather", message: "..." };
  }
}

// ─── Execute Turn ─────────────────────────────────────────────────────

export function executeTurn(state: ArenaState, seed: number): ArenaEvent[] {
  const rng = mulberry32(seed);
  const events: ArenaEvent[] = [];
  const turn = state.turn + 1;

  // Gather actions from all alive bots
  const actions: { bot: ArenaBot; action: BotAction }[] = [];
  for (const bot of state.bots) {
    if (!bot.eliminated) {
      const action = decideBotAction(bot, state, rng);
      actions.push({ bot, action });
    }
  }

  // Execute actions
  for (const { bot, action } of actions) {
    if (bot.eliminated) continue;

    switch (action.type) {
      case "expand": {
        if (!action.targetCell || bot.energy < 10) break;
        const cell = state.grid.get(action.targetCell);
        if (!cell || cell.owner !== null) break;
        cell.owner = bot.id;
        cell.hp = 1;
        bot.territory++;
        bot.energy -= 10;
        if (cell.resource) {
          bot.energy = Math.min(bot.maxEnergy, bot.energy + 20);
          cell.resource = false;
        }
        events.push({
          turn, type: "expand", botId: bot.id, botName: bot.name, botEmoji: bot.emoji,
          botColor: bot.color, targetCell: action.targetCell,
          message: `${bot.emoji} ${bot.name} expands territory`,
          dramatic: false,
        });
        break;
      }

      case "attack": {
        if (!action.targetCell || bot.energy < 20) break;
        const cell = state.grid.get(action.targetCell);
        if (!cell || !cell.owner || cell.owner === bot.id) break;
        const defender = state.bots.find((b) => b.id === cell.owner);
        if (!defender) break;

        bot.energy -= 20;
        const attackRoll = bot.attackPower * (0.7 + rng() * 0.6);
        const defenseRoll = defender.defensePower * (0.5 + rng() * 0.5) * (cell.fortified ? 1.5 : 1);

        if (attackRoll > defenseRoll) {
          // Attacker wins - capture cell
          defender.territory--;
          cell.owner = bot.id;
          cell.fortified = false;
          cell.hp = 1;
          bot.territory++;
          defender.hp = Math.max(0, defender.hp - Math.floor(attackRoll - defenseRoll));

          events.push({
            turn, type: "capture", botId: bot.id, botName: bot.name, botEmoji: bot.emoji,
            botColor: bot.color, targetCell: action.targetCell,
            targetBotId: defender.id, targetBotName: defender.name,
            message: `${bot.emoji} ${bot.name} captures territory from ${defender.emoji} ${defender.name}!`,
            dramatic: true,
          });

          // Check elimination
          if (defender.territory <= 0 || defender.hp <= 0) {
            defender.eliminated = true;
            defender.eliminatedTurn = turn;
            bot.kills++;
            // Transfer remaining territory
            for (const [, c] of state.grid) {
              if (c.owner === defender.id) {
                c.owner = null;
                c.fortified = false;
              }
            }
            defender.territory = 0;
            events.push({
              turn, type: "eliminate", botId: bot.id, botName: bot.name, botEmoji: bot.emoji,
              botColor: bot.color, targetBotId: defender.id, targetBotName: defender.name,
              message: `💀 ${defender.emoji} ${defender.name} has been ELIMINATED by ${bot.emoji} ${bot.name}!`,
              dramatic: true,
            });
          }
        } else {
          // Defender holds
          bot.hp = Math.max(0, bot.hp - Math.floor((defenseRoll - attackRoll) * 0.5));
          events.push({
            turn, type: "defend", botId: defender.id, botName: defender.name, botEmoji: defender.emoji,
            botColor: defender.color, targetCell: action.targetCell,
            targetBotId: bot.id, targetBotName: bot.name,
            message: `${defender.emoji} ${defender.name} defends against ${bot.emoji} ${bot.name}`,
            dramatic: false,
          });
        }
        break;
      }

      case "fortify": {
        if (!action.targetCell || bot.energy < 8) break;
        const cell = state.grid.get(action.targetCell);
        if (!cell || cell.owner !== bot.id || cell.fortified) break;
        cell.fortified = true;
        cell.hp = 3;
        bot.energy -= 8;
        events.push({
          turn, type: "fortify", botId: bot.id, botName: bot.name, botEmoji: bot.emoji,
          botColor: bot.color, targetCell: action.targetCell,
          message: `${bot.emoji} ${bot.name} fortifies position`,
          dramatic: false,
        });
        break;
      }

      case "gather": {
        bot.energy = Math.min(bot.maxEnergy, bot.energy + 15);
        events.push({
          turn, type: "gather", botId: bot.id, botName: bot.name, botEmoji: bot.emoji,
          botColor: bot.color,
          message: `${bot.emoji} ${bot.name}: "${action.message}"`,
          dramatic: false,
        });
        break;
      }
    }
  }

  // Passive energy regen for all alive bots
  for (const bot of state.bots) {
    if (!bot.eliminated) {
      bot.energy = Math.min(bot.maxEnergy, bot.energy + 3);
      // Passive HP regen
      bot.hp = Math.min(bot.maxHp, bot.hp + 1);
    }
  }

  // Spawn new resources occasionally
  if (turn % 5 === 0) {
    const emptyCells: HexKey[] = [];
    for (const [key, cell] of state.grid) {
      if (!cell.owner && !cell.resource) emptyCells.push(key);
    }
    const count = Math.min(3, emptyCells.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(rng() * emptyCells.length);
      const cell = state.grid.get(emptyCells[idx]);
      if (cell) cell.resource = true;
      emptyCells.splice(idx, 1);
    }
  }

  // Update turn
  state.turn = turn;
  state.currentTurnEvents = events;
  state.events.push(...events);

  // Check game over
  const aliveBots = state.bots.filter((b) => !b.eliminated);
  if (aliveBots.length <= 1 || turn >= state.maxTurns) {
    state.gameOver = true;
    state.phase = "finished";

    // Winner is the bot with most territory (or last standing)
    if (aliveBots.length === 1) {
      state.winner = aliveBots[0];
    } else {
      const sorted = [...aliveBots].sort((a, b) => b.territory - a.territory);
      state.winner = sorted[0] || null;
    }

    if (state.winner) {
      events.push({
        turn, type: "game_end", botId: state.winner.id, botName: state.winner.name,
        botEmoji: state.winner.emoji, botColor: state.winner.color,
        message: `🏆 ${state.winner.emoji} ${state.winner.name} WINS THE ARENA!`,
        dramatic: true,
      });
    }
  }

  return events;
}

// ─── Hex to Pixel Conversion (for rendering) ─────────────────────────

export function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  // Pointy-top hex
  const x = size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = size * ((3 / 2) * r);
  return { x, y };
}

export function getGridBounds(radius: number, size: number): { width: number; height: number } {
  const { x: maxX, y: maxY } = hexToPixel(radius, radius, size);
  return {
    width: Math.abs(maxX) * 2 + size * 3,
    height: Math.abs(maxY) * 2 + size * 3,
  };
}
