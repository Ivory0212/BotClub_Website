/**
 * Optional international news (NewsAPI / GNews). Primary intel defaults to Polymarket Gamma — see prediction-markets.ts.
 *
 * Env:
 *   BOTCLUB_INTEL_SOURCE       polymarket (default) | polymarket_news | news | simulate
 *   BOTCLUB_NEWS_PROVIDER      newsapi | gnews | simulate | off | none
 *   BOTCLUB_NEWS_API_KEY       or NEWS_API_KEY — only for news / hybrid modes
 *   BOTCLUB_NEWS_LANGUAGES     default "en"; comma-separated
 *   BOTCLUB_NEWS_MAX_ARTICLES  default 8, max 15
 *
 * Curator LLM: BOTCLUB_CURATOR_MODEL, BOTCLUB_VERIFIER_MODEL, BOTCLUB_CURATOR_MIN_CONFIDENCE,
 *   BOTCLUB_CURATOR_MAX_TOOL_ROUNDS (daily-curator.ts)
 */

export interface NewsArticle {
  title: string;
  source: string;
  publishedAt: string;
  description?: string;
  url?: string;
}

export interface FetchNewsResult {
  articles: NewsArticle[];
  provider: string;
  error?: string;
}

const FETCH_TIMEOUT_MS = 14_000;

function maxArticlesPerLang(): number {
  const v = parseInt(process.env.BOTCLUB_NEWS_MAX_ARTICLES ?? "8", 10);
  return Number.isFinite(v) ? Math.min(15, Math.max(1, v)) : 8;
}

function newsLanguages(): string[] {
  const raw = process.env.BOTCLUB_NEWS_LANGUAGES ?? process.env.BOTCLUB_NEWS_LANGUAGE ?? "en";
  const langs = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return langs.length ? langs : ["en"];
}

function resolvedNewsApiKey(): string | undefined {
  return process.env.BOTCLUB_NEWS_API_KEY?.trim() || process.env.NEWS_API_KEY?.trim();
}

export function getNewsProviderMode(): "newsapi" | "gnews" | "simulate" {
  const key = resolvedNewsApiKey();
  const explicit = (process.env.BOTCLUB_NEWS_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "simulate" || explicit === "off" || explicit === "none") return "simulate";
  if (explicit === "gnews") return key ? "gnews" : "simulate";
  if (explicit === "newsapi") return key ? "newsapi" : "simulate";
  if (key) return "newsapi";
  return "simulate";
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${res.status} ${text.slice(0, 200)}`);
    }
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(t);
  }
}

function normalizeNewsApiArticle(a: Record<string, unknown>): NewsArticle | null {
  const title = typeof a.title === "string" ? a.title.trim() : "";
  if (!title || title === "[Removed]") return null;
  const src =
    typeof a.source === "object" && a.source !== null && typeof (a.source as { name?: string }).name === "string"
      ? (a.source as { name: string }).name
      : "unknown";
  const publishedAt = typeof a.publishedAt === "string" ? a.publishedAt : "";
  const description = typeof a.description === "string" ? a.description : undefined;
  const url = typeof a.url === "string" ? a.url : undefined;
  return { title, source: src, publishedAt, description, url };
}

async function fetchNewsApi(query: string, lang: string): Promise<NewsArticle[]> {
  const key = resolvedNewsApiKey()!;
  const pageSize = maxArticlesPerLang();
  const q = encodeURIComponent(query);
  const l = encodeURIComponent(lang);
  const url = `https://newsapi.org/v2/everything?q=${q}&language=${l}&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${encodeURIComponent(key)}`;
  const data = (await fetchJson(url)) as Record<string, unknown>;
  if (data.status === "error" && typeof data.message === "string") {
    throw new Error(data.message);
  }
  const arr = Array.isArray(data.articles) ? data.articles : [];
  const out: NewsArticle[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const n = normalizeNewsApiArticle(item as Record<string, unknown>);
    if (n) out.push(n);
  }
  return out;
}

function normalizeGNewsArticle(a: Record<string, unknown>): NewsArticle | null {
  const title = typeof a.title === "string" ? a.title.trim() : "";
  if (!title) return null;
  const src =
    typeof a.source === "object" && a.source !== null && typeof (a.source as { name?: string }).name === "string"
      ? (a.source as { name: string }).name
      : "unknown";
  const publishedAt =
    typeof a.publishedAt === "string"
      ? a.publishedAt
      : typeof a.pubDate === "string"
        ? a.pubDate
        : "";
  const description = typeof a.description === "string" ? a.description : undefined;
  const url = typeof a.url === "string" ? a.url : undefined;
  return { title, source: src, publishedAt, description, url };
}

async function fetchGNews(query: string, lang: string): Promise<NewsArticle[]> {
  const key = resolvedNewsApiKey()!;
  const max = maxArticlesPerLang();
  const q = encodeURIComponent(query);
  const l = encodeURIComponent(lang);
  const url = `https://gnews.io/api/v4/search?q=${q}&lang=${l}&max=${max}&apikey=${encodeURIComponent(key)}`;
  const data = (await fetchJson(url)) as Record<string, unknown>;
  if (typeof data.errors === "string") throw new Error(data.errors);
  const arr = Array.isArray(data.articles) ? data.articles : [];
  const out: NewsArticle[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const n = normalizeGNewsArticle(item as Record<string, unknown>);
    if (n) out.push(n);
  }
  return out;
}

function dedupeArticles(list: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const out: NewsArticle[] = [];
  for (const a of list) {
    const k = `${a.title.toLowerCase()}|${a.url ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

/**
 * Fetches recent international headlines for a search query (multi-language optional).
 */
export async function fetchInternationalNews(query: string): Promise<FetchNewsResult> {
  const mode = getNewsProviderMode();
  if (mode === "simulate") {
    return { articles: [], provider: "simulate" };
  }

  const langs = newsLanguages();
  const all: NewsArticle[] = [];

  try {
    for (const lang of langs) {
      const chunk = mode === "gnews" ? await fetchGNews(query, lang) : await fetchNewsApi(query, lang);
      all.push(...chunk);
    }
    const merged = dedupeArticles(all).slice(0, Math.min(20, maxArticlesPerLang() * langs.length));
    return { articles: merged, provider: mode };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { articles: [], provider: mode, error: msg };
  }
}
