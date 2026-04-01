/**
 * Site audience: online (smoothed) + cumulative visits.
 * Cumulative total is persisted to data/site-stats.json (survives restarts on same disk).
 *
 * Env:
 *   BOTCLUB_STATS_ONLINE_FLOOR   在線顯示下限（預設 38）
 *   BOTCLUB_STATS_ONLINE_CAP     在線顯示上限（預設 188）
 *   BOTCLUB_STATS_VISIT_SEED     與檔案取 max 作為起算底數（無檔案時）
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const PING_TTL_MS = 3 * 60 * 1000;
const DATA_FILE = path.join(process.cwd(), "data", "site-stats.json");

type SiteStatsStore = {
  totalVisits: number;
  sessions: Map<string, number>;
  displayOnline: number;
};

type PersistedShape = {
  totalVisits: number;
  updatedAt?: string;
};

const g = globalThis as unknown as {
  __botclub_site_stats?: SiteStatsStore;
  __botclub_site_stats_hydrate?: Promise<void>;
  __botclub_site_stats_hydrated?: boolean;
  __botclub_site_stats_persist?: Promise<void>;
};

function visitSeed(): number {
  const raw = process.env.BOTCLUB_STATS_VISIT_SEED;
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(99_999_999, n) : 0;
}

function store(): SiteStatsStore {
  if (!g.__botclub_site_stats) {
    const floor = onlineFloor();
    g.__botclub_site_stats = {
      totalVisits: visitSeed(),
      sessions: new Map(),
      displayOnline: floor + Math.floor(Math.random() * 18),
    };
  }
  return g.__botclub_site_stats;
}

function onlineFloor(): number {
  const n = parseInt(process.env.BOTCLUB_STATS_ONLINE_FLOOR ?? "38", 10);
  return Number.isFinite(n) ? Math.max(12, Math.min(200, n)) : 38;
}

function onlineCap(): number {
  const n = parseInt(process.env.BOTCLUB_STATS_ONLINE_CAP ?? "188", 10);
  return Number.isFinite(n) ? Math.max(onlineFloor() + 10, Math.min(999, n)) : 188;
}

function pruneSessions(sessions: Map<string, number>, now: number): void {
  for (const [id, t] of sessions) {
    if (now - t > PING_TTL_MS) sessions.delete(id);
  }
}

function realOnline(sessions: Map<string, number>, now: number): number {
  let n = 0;
  for (const [, t] of sessions) {
    if (now - t <= PING_TTL_MS) n += 1;
  }
  return n;
}

async function readPersistedTotal(): Promise<number | null> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    const j = JSON.parse(raw) as PersistedShape;
    if (typeof j.totalVisits === "number" && j.totalVisits >= 0 && Number.isFinite(j.totalVisits)) {
      return Math.floor(j.totalVisits);
    }
  } catch {
    /* missing or invalid */
  }
  return null;
}

function queuePersistTotalVisits(value: number): void {
  g.__botclub_site_stats_persist = (g.__botclub_site_stats_persist ?? Promise.resolve()).then(async () => {
    try {
      await mkdir(path.dirname(DATA_FILE), { recursive: true });
      const payload: PersistedShape = {
        totalVisits: value,
        updatedAt: new Date().toISOString(),
      };
      await writeFile(DATA_FILE, JSON.stringify(payload), "utf-8");
    } catch (e) {
      console.error("[site-stats] persist failed:", e);
    }
  });
}

/**
 * Merge disk total into memory once per process (call from API before recording).
 */
export async function hydrateTotalVisitsFromDiskOnce(): Promise<void> {
  if (g.__botclub_site_stats_hydrated) return;
  if (!g.__botclub_site_stats_hydrate) {
    g.__botclub_site_stats_hydrate = (async () => {
      try {
        const disk = await readPersistedTotal();
        const s = store();
        if (disk !== null) {
          s.totalVisits = Math.max(s.totalVisits, disk);
        }
      } finally {
        g.__botclub_site_stats_hydrated = true;
      }
    })();
  }
  await g.__botclub_site_stats_hydrate;
}

/**
 * Register a heartbeat; if isNewSession, bump cumulative visits and queue disk write.
 */
export function recordSessionPing(sessionId: string, isNewSession: boolean): { online: number; totalVisits: number } {
  const s = store();
  const now = Date.now();
  if (isNewSession) {
    s.totalVisits += 1;
    queuePersistTotalVisits(s.totalVisits);
  }
  s.sessions.set(sessionId, now);
  pruneSessions(s.sessions, now);

  const floor = onlineFloor();
  const cap = onlineCap();
  const real = realOnline(s.sessions, now);

  const jitter = Math.floor(Math.random() * 9) - 4;
  const tensBump = Math.random() < 0.12 ? (Math.floor(Math.random() * 5) - 2) * 3 : 0;
  let target = floor + real * 3 + jitter * 2 + tensBump;
  target = Math.min(cap, Math.max(floor, target));

  const alpha = 0.14;
  s.displayOnline = s.displayOnline * (1 - alpha) + target * alpha;

  if (s.displayOnline < floor + 2) s.displayOnline += Math.random() * 1.5;
  if (s.displayOnline > cap - 2) s.displayOnline -= Math.random() * 1.5;

  const online = Math.round(Math.min(cap, Math.max(floor, s.displayOnline)));

  return { online, totalVisits: s.totalVisits };
}
