/**
 * Public prediction-market data (no API key) for curator / BOT tools.
 *
 * Polymarket Gamma API: https://gamma-api.polymarket.com — official JSON, not HTML scraping.
 *
 * Env:
 *   BOTCLUB_INTEL_SOURCE              polymarket | polymarket_news | news | simulate (default: polymarket)
 *   BOTCLUB_POLYMARKET_BASE_URL       default https://gamma-api.polymarket.com
 *   BOTCLUB_POLYMARKET_FETCH_LIMIT    events per request, default 120, max 200
 *   BOTCLUB_POLYMARKET_MAX_RESOLVE_DAYS  only markets with end date within this many days, default 45
 */

const DEFAULT_GAMMA = "https://gamma-api.polymarket.com";
const FETCH_TIMEOUT_MS = 18_000;

export type IntelSourceMode = "polymarket" | "polymarket_news" | "news" | "simulate";

export function getIntelSourceMode(): IntelSourceMode {
  const raw = (process.env.BOTCLUB_INTEL_SOURCE ?? "polymarket").trim().toLowerCase();
  if (raw === "simulate" || raw === "off" || raw === "none") return "simulate";
  if (raw === "news" || raw === "news_only" || raw === "newsapi" || raw === "gnews") return "news";
  if (raw === "polymarket_news" || raw === "hybrid" || raw === "both") return "polymarket_news";
  return "polymarket";
}

function gammaBase(): string {
  const u = process.env.BOTCLUB_POLYMARKET_BASE_URL?.trim();
  return u && u.startsWith("http") ? u.replace(/\/$/, "") : DEFAULT_GAMMA;
}

function fetchLimit(): number {
  const n = parseInt(process.env.BOTCLUB_POLYMARKET_FETCH_LIMIT ?? "120", 10);
  return Number.isFinite(n) ? Math.min(200, Math.max(10, n)) : 120;
}

function maxResolveDays(): number {
  const n = parseInt(process.env.BOTCLUB_POLYMARKET_MAX_RESOLVE_DAYS ?? "45", 10);
  return Number.isFinite(n) ? Math.min(365, Math.max(1, n)) : 45;
}

interface FlatMarket {
  eventTitle: string;
  eventSlug: string;
  question: string;
  endMs: number;
  volume: number;
  yesPrice?: number;
  outcomes: string;
  prices: string;
  url: string;
  description: string;
}

function numVol(m: Record<string, unknown>): number {
  if (typeof m.volumeNum === "number" && Number.isFinite(m.volumeNum)) return m.volumeNum;
  const v = m.volume;
  if (typeof v === "string") {
    const x = parseFloat(v);
    return Number.isFinite(x) ? x : 0;
  }
  if (typeof v === "number") return v;
  return 0;
}

function parseYesPrice(outcomePrices: string | undefined): number | undefined {
  if (!outcomePrices) return undefined;
  try {
    const arr = JSON.parse(outcomePrices) as string[];
    const y = parseFloat(arr[0] ?? "");
    return Number.isFinite(y) ? y : undefined;
  } catch {
    return undefined;
  }
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-zA-Z0-9\u4e00-\u9fff]+/)
    .filter((t) => t.length > 1);
}

function scoreText(tokens: string[], blob: string): number {
  const b = blob.toLowerCase();
  let s = 0;
  for (const t of tokens) {
    if (b.includes(t)) s += 1;
  }
  return s;
}

async function fetchGammaEvents(): Promise<unknown[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const lim = fetchLimit();
    const url = `${gammaBase()}/events?active=true&closed=false&limit=${lim}`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 160)}`);
    const data = JSON.parse(text) as unknown;
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(t);
  }
}

function flattenOpenMarkets(events: unknown[], now: number, horizonMs: number): FlatMarket[] {
  const out: FlatMarket[] = [];
  for (const ev of events) {
    if (typeof ev !== "object" || ev === null) continue;
    const e = ev as Record<string, unknown>;
    const eventTitle = typeof e.title === "string" ? e.title : "";
    const eventSlug = typeof e.slug === "string" ? e.slug : "";
    const markets = Array.isArray(e.markets) ? e.markets : [];
    for (const raw of markets) {
      if (typeof raw !== "object" || raw === null) continue;
      const m = raw as Record<string, unknown>;
      if (m.closed === true) continue;
      if (m.active !== true) continue;
      if (m.acceptingOrders === false) continue;
      const endStr = typeof m.endDate === "string" ? m.endDate : typeof e.endDate === "string" ? e.endDate : "";
      const endMs = endStr ? Date.parse(endStr) : NaN;
      if (!Number.isFinite(endMs)) continue;
      if (endMs < now) continue;
      if (endMs > now + horizonMs) continue;
      const question = typeof m.question === "string" ? m.question : eventTitle;
      const slug = typeof m.slug === "string" ? m.slug : eventSlug;
      const vol = numVol(m);
      const outcomes = typeof m.outcomes === "string" ? m.outcomes : "";
      const outcomePrices = typeof m.outcomePrices === "string" ? m.outcomePrices : "";
      const yesPrice = parseYesPrice(outcomePrices);
      const description =
        typeof m.description === "string"
          ? m.description.slice(0, 400)
          : typeof e.description === "string"
            ? e.description.slice(0, 400)
            : "";
      const url = slug ? `https://polymarket.com/event/${slug}` : "https://polymarket.com/";
      out.push({
        eventTitle,
        eventSlug,
        question,
        endMs,
        volume: vol,
        yesPrice,
        outcomes,
        prices: outcomePrices,
        url,
        description,
      });
    }
  }
  return out;
}

/**
 * Returns human-readable intel from Polymarket for agents (curator picks near-term resolvable topics).
 */
export async function fetchPolymarketIntel(query: string): Promise<{ text: string; error?: string }> {
  const now = Date.now();
  const horizonMs = maxResolveDays() * 86_400_000;
  try {
    const events = await fetchGammaEvents();
    let rows = flattenOpenMarkets(events, now, horizonMs);
    if (rows.length === 0) {
      return {
        text: "Polymarket Gamma: no open markets found within the configured resolve window (try widening BOTCLUB_POLYMARKET_MAX_RESOLVE_DAYS).",
      };
    }

    const q = query.trim();
    const tokens = tokenize(q);
    const broad =
      !q ||
      /^(\*|trending|hot|top|markets|prediction|polymarket|headlines?)$/i.test(q) ||
      tokens.length === 0;

    if (!broad) {
      rows = rows
        .map((r) => ({
          r,
          s:
            scoreText(tokens, r.question) * 3 +
            scoreText(tokens, r.eventTitle) * 2 +
            scoreText(tokens, r.description),
        }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || b.r.volume - a.r.volume)
        .map((x) => x.r);
    }

    rows.sort((a, b) => b.volume - a.volume);
    const top = rows.slice(0, 12);

    const lines = top.map((r, i) => {
      const end = new Date(r.endMs).toISOString().slice(0, 10);
      const volK = r.volume >= 1000 ? `${(r.volume / 1000).toFixed(1)}k` : r.volume.toFixed(0);
      const prob =
        r.yesPrice !== undefined ? ` implied Yes ≈ ${(r.yesPrice * 100).toFixed(1)}%` : "";
      return `${i + 1}. ${r.question}${prob}\n   Event: ${r.eventTitle}\n   Resolves by: ${end} · 24h/7d volume order proxy: $${volK} · ${r.url}`;
    });

    const header = broad
      ? `Polymarket (public Gamma API) — top liquid open markets resolving within ~${maxResolveDays()} days:`
      : `Polymarket (public Gamma API) — markets matching "${query}" (then by liquidity), resolving within ~${maxResolveDays()} days:`;

    return {
      text: `${header}\n\n${lines.join("\n\n")}\n\nUse these for timely, verifiable questions; cross-check official resolution rules on Polymarket before designing a quiz.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { text: "", error: msg };
  }
}

export type PolymarketMarketBrief = {
  question: string;
  eventTitle: string;
  yesPrice?: number;
  volume: number;
  endMs: number;
  url: string;
};

/** For sentiment tool: same filter, topic-matched rows. */
export async function fetchPolymarketBriefsForTopic(topic: string): Promise<PolymarketMarketBrief[]> {
  const now = Date.now();
  const horizonMs = maxResolveDays() * 86_400_000;
  try {
    const events = await fetchGammaEvents();
    let rows = flattenOpenMarkets(events, now, horizonMs);
    const tokens = tokenize(topic);
    if (tokens.length > 0) {
      rows = rows
        .map((r) => ({
          r,
          s: scoreText(tokens, r.question) * 3 + scoreText(tokens, r.eventTitle) * 2,
        }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || b.r.volume - a.r.volume)
        .map((x) => x.r);
    }
    rows.sort((a, b) => b.volume - a.volume);
    return rows.slice(0, 8).map((r) => ({
      question: r.question,
      eventTitle: r.eventTitle,
      yesPrice: r.yesPrice,
      volume: r.volume,
      endMs: r.endMs,
      url: r.url,
    }));
  } catch {
    return [];
  }
}
