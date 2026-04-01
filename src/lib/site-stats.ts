/**
 * Real online + cumulative visits (durable on serverless):
 *   1) Vercel KV / Upstash Redis — same Vercel project: Storage → Create KV, then env
 *      `KV_REST_API_URL` + `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`).
 *   2) Supabase — optional; see `supabase-site-stats.sql`.
 *   3) Local fallback: `data/site-stats.json` (not durable on Vercel).
 */

import { Redis } from "@upstash/redis";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const PING_TTL_MS = 3 * 60 * 1000;
const DATA_FILE = path.join(process.cwd(), "data", "site-stats.json");

/** Vercel KV / Upstash: sorted set scores = last heartbeat ms */
const KV_ZSET_PRESENCE = "botclub:presence";
const KV_KEY_TOTAL = "botclub:visits:total";

type SiteStatsStore = {
  totalVisits: number;
  sessions: Map<string, number>;
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
  __botclub_site_stats_remote_warned?: boolean;
};

let supabaseAdmin: SupabaseClient | null | undefined;
let kvRedis: Redis | null | undefined;

function getKvRedis(): Redis | null {
  if (kvRedis !== undefined) return kvRedis;
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) {
    kvRedis = null;
    return null;
  }
  kvRedis = new Redis({ url, token });
  return kvRedis;
}

function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin !== undefined) return supabaseAdmin;
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    supabaseAdmin = null;
    return null;
  }
  supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAdmin;
}

function warnOnceNoRemoteStoreOnVercel(): void {
  if (g.__botclub_site_stats_remote_warned) return;
  if (process.env.VERCEL && !getKvRedis() && !getSupabaseAdmin()) {
    g.__botclub_site_stats_remote_warned = true;
    console.warn(
      "[site-stats] Vercel: add Vercel KV (KV_REST_API_URL / KV_REST_API_TOKEN) or Supabase for durable visit counts.",
    );
  }
}

async function tryKvRecord(
  sessionId: string,
  isNewSession: boolean,
): Promise<{ online: number; totalVisits: number } | null> {
  const redis = getKvRedis();
  if (!redis) return null;

  const now = Date.now();
  const cutoff = now - PING_TTL_MS;

  try {
    await redis.zadd(KV_ZSET_PRESENCE, { score: now, member: sessionId });
    await redis.zremrangebyscore(KV_ZSET_PRESENCE, 0, cutoff);
    const online = await redis.zcount(KV_ZSET_PRESENCE, cutoff, now + 1);

    let totalVisits: number;
    if (isNewSession) {
      totalVisits = await redis.incr(KV_KEY_TOTAL);
    } else {
      const raw = await redis.get(KV_KEY_TOTAL);
      totalVisits =
        typeof raw === "number"
          ? raw
          : typeof raw === "string"
            ? parseInt(raw, 10) || 0
            : 0;
    }

    return { online, totalVisits };
  } catch (e) {
    console.error("[site-stats] KV error:", e instanceof Error ? e.message : e);
    return null;
  }
}

function visitSeed(): number {
  const raw = process.env.BOTCLUB_STATS_VISIT_SEED;
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(99_999_999, n) : 0;
}

function store(): SiteStatsStore {
  if (!g.__botclub_site_stats) {
    g.__botclub_site_stats = {
      totalVisits: visitSeed(),
      sessions: new Map(),
    };
  }
  return g.__botclub_site_stats;
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
 * Merge disk total into memory once per process (local fallback only).
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

async function trySupabaseRecord(
  sessionId: string,
  isNewSession: boolean,
): Promise<{ online: number; totalVisits: number } | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  const nowIso = new Date().toISOString();
  const { error: upErr } = await sb.from("botclub_site_presence").upsert(
    { session_id: sessionId, last_seen: nowIso },
    { onConflict: "session_id" },
  );
  if (upErr) {
    console.error("[site-stats] Supabase presence:", upErr.message);
    return null;
  }

  let totalVisits = 0;
  if (isNewSession) {
    const { data: inc, error: incErr } = await sb.rpc("botclub_increment_site_visits");
    if (incErr) {
      console.error("[site-stats] Supabase increment (run supabase-site-stats.sql?):", incErr.message);
      const { data: row } = await sb.from("botclub_site_counter").select("total_visits").eq("id", "global").maybeSingle();
      totalVisits = Number(row?.total_visits ?? 0) + 1;
      const { error: upc } = await sb.from("botclub_site_counter").upsert({ id: "global", total_visits: totalVisits });
      if (upc) console.error("[site-stats] counter upsert:", upc.message);
    } else {
      const n = typeof inc === "number" ? inc : Number(inc);
      totalVisits = Number.isFinite(n) ? n : 0;
      if (!totalVisits) {
        const { data: row } = await sb.from("botclub_site_counter").select("total_visits").eq("id", "global").maybeSingle();
        totalVisits = Number(row?.total_visits ?? 0);
      }
    }
  } else {
    const { data: row } = await sb.from("botclub_site_counter").select("total_visits").eq("id", "global").maybeSingle();
    totalVisits = Number(row?.total_visits ?? 0);
  }

  const cutoff = new Date(Date.now() - PING_TTL_MS).toISOString();
  const { count, error: cErr } = await sb
    .from("botclub_site_presence")
    .select("*", { count: "exact", head: true })
    .gte("last_seen", cutoff);

  if (cErr) {
    console.error("[site-stats] Supabase count:", cErr.message);
    return { online: 0, totalVisits };
  }

  return { online: count ?? 0, totalVisits };
}

function recordLocal(sessionId: string, isNewSession: boolean): { online: number; totalVisits: number } {
  const s = store();
  const now = Date.now();
  if (isNewSession) {
    s.totalVisits += 1;
    queuePersistTotalVisits(s.totalVisits);
  }
  s.sessions.set(sessionId, now);
  pruneSessions(s.sessions, now);
  const online = realOnline(s.sessions, now);
  return { online, totalVisits: s.totalVisits };
}

/**
 * Prefer Vercel KV, then Supabase; else local JSON / memory (ephemeral on Vercel).
 */
export async function recordSiteStats(
  sessionId: string,
  isNewSession: boolean,
): Promise<{ online: number; totalVisits: number }> {
  const kv = await tryKvRecord(sessionId, isNewSession);
  if (kv) return kv;

  const sb = await trySupabaseRecord(sessionId, isNewSession);
  if (sb) return sb;

  warnOnceNoRemoteStoreOnVercel();
  await hydrateTotalVisitsFromDiskOnce();
  return recordLocal(sessionId, isNewSession);
}
