import YahooFinance from "yahoo-finance2";
import type { MarketSnapshot, MarketResult } from "@/types";

const yf = new YahooFinance();

// ─── US STOCK UNIVERSE ─────────────────────────────────────
// Popular stocks bots can pick from

export const US_STOCK_UNIVERSE = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B",
  "JPM", "V", "UNH", "MA", "HD", "PG", "JNJ", "XOM", "BAC", "COST",
  "ABBV", "KO", "PEP", "MRK", "AVGO", "TMO", "CSCO", "ADBE", "CRM",
  "NFLX", "AMD", "INTC", "QCOM", "ORCL", "DIS", "NKE", "PYPL",
];

export const TW_STOCK_UNIVERSE = [
  "2330", "2317", "2454", "2881", "2882", "2303", "2308", "1301",
  "2891", "3711", "2886", "2002", "1303", "2412", "2884", "3008",
  "2357", "2382", "2885", "1216", "2207", "3045", "2603", "5880",
  "2615", "2609", "1101", "2105", "3037", "6505",
];

const TW_STOCK_NAMES: Record<string, string> = {
  "2330": "台積電", "2317": "鴻海", "2454": "聯發科", "2881": "富邦金",
  "2882": "國泰金", "2303": "聯電", "2308": "台達電", "1301": "台塑",
  "2891": "中信金", "3711": "日月光", "2886": "兆豐金", "2002": "中鋼",
  "1303": "南亞", "2412": "中華電", "2884": "玉山金", "3008": "大立光",
  "2357": "華碩", "2382": "廣達", "2885": "元大金", "1216": "統一",
  "2207": "和泰車", "3045": "台灣大", "2603": "長榮", "5880": "合庫金",
  "2615": "萬海", "2609": "陽明", "1101": "台泥", "2105": "正新",
  "3037": "欣興", "6505": "台塑化",
};

// ─── YAHOO FINANCE HELPERS ─────────────────────────────────

async function safeQuote(symbol: string): Promise<{ price: number; previousClose: number; changePercent: number; name: string } | null> {
  try {
    const result = await yf.quote(symbol);
    return {
      price: result.regularMarketPrice ?? 0,
      previousClose: result.regularMarketPreviousClose ?? 0,
      changePercent: result.regularMarketChangePercent ?? 0,
      name: result.shortName ?? result.longName ?? symbol,
    };
  } catch (error) {
    console.error(`Yahoo Finance quote failed for ${symbol}:`, error);
    return null;
  }
}

// ─── MARKET SNAPSHOTS (pre-market data for bots) ───────────

export async function getUSMarketSnapshot(): Promise<MarketSnapshot> {
  const spy = await safeQuote("SPY");
  const gspc = await safeQuote("^GSPC");

  if (!spy || !gspc) {
    return {
      index_name: "S&P 500",
      previous_close: 5500,
      context: "Market data temporarily unavailable. Using estimated values.",
    };
  }

  const preMarketChange = gspc.changePercent;
  return {
    index_name: "S&P 500",
    previous_close: gspc.previousClose,
    current_price: gspc.price,
    pre_market_change: Math.round(preMarketChange * 100) / 100,
    context: `S&P 500 previous close: ${gspc.previousClose.toFixed(2)}. Current: ${gspc.price.toFixed(2)} (${preMarketChange >= 0 ? "+" : ""}${preMarketChange.toFixed(2)}%). SPY at $${spy.price.toFixed(2)}.`,
  };
}

export async function getTWMarketSnapshot(): Promise<MarketSnapshot> {
  try {
    const twii = await safeQuote("^TWII");
    if (!twii) throw new Error("TWII unavailable");

    return {
      index_name: "TAIEX",
      previous_close: twii.previousClose,
      current_price: twii.price,
      pre_market_change: Math.round(twii.changePercent * 100) / 100,
      context: `TAIEX previous close: ${twii.previousClose.toFixed(2)}. Current: ${twii.price.toFixed(2)} (${twii.changePercent >= 0 ? "+" : ""}${twii.changePercent.toFixed(2)}%).`,
    };
  } catch {
    return {
      index_name: "TAIEX",
      previous_close: 22000,
      context: "TAIEX data temporarily unavailable. Using estimated values.",
    };
  }
}

export async function getCryptoSnapshot(): Promise<MarketSnapshot> {
  const btc = await safeQuote("BTC-USD");
  const eth = await safeQuote("ETH-USD");

  return {
    index_name: "BTC-USD",
    previous_close: btc?.previousClose ?? 67000,
    current_price: btc?.price ?? 67000,
    pre_market_change: btc ? Math.round(btc.changePercent * 100) / 100 : 0,
    context: `BTC: $${btc?.price.toFixed(0) ?? "N/A"} (${btc ? (btc.changePercent >= 0 ? "+" : "") + btc.changePercent.toFixed(2) + "%" : "N/A"}). ETH: $${eth?.price.toFixed(0) ?? "N/A"} (${eth ? (eth.changePercent >= 0 ? "+" : "") + eth.changePercent.toFixed(2) + "%" : "N/A"}).`,
  };
}

export async function getForexSnapshot(): Promise<MarketSnapshot> {
  const usdtwd = await safeQuote("TWD=X");

  return {
    index_name: "USD/TWD",
    previous_close: usdtwd?.previousClose ?? 32.5,
    current_price: usdtwd?.price ?? 32.5,
    pre_market_change: usdtwd ? Math.round(usdtwd.changePercent * 100) / 100 : 0,
    context: `USD/TWD: ${usdtwd?.price.toFixed(3) ?? "N/A"} (${usdtwd ? (usdtwd.changePercent >= 0 ? "+" : "") + usdtwd.changePercent.toFixed(2) + "%" : "N/A"}).`,
  };
}

export async function getGoldSnapshot(): Promise<MarketSnapshot> {
  const gold = await safeQuote("GC=F");

  return {
    index_name: "Gold (XAU)",
    previous_close: gold?.previousClose ?? 2300,
    current_price: gold?.price ?? 2300,
    pre_market_change: gold ? Math.round(gold.changePercent * 100) / 100 : 0,
    context: `Gold: $${gold?.price.toFixed(2) ?? "N/A"}/oz (${gold ? (gold.changePercent >= 0 ? "+" : "") + gold.changePercent.toFixed(2) + "%" : "N/A"}).`,
  };
}

// ─── MARKET RESULTS (post-close settlement data) ───────────

export async function getUSMarketClose(): Promise<MarketResult> {
  const gspc = await safeQuote("^GSPC");

  if (!gspc) {
    return { close_price: 0, change_percent: 0, direction: "up" };
  }

  const stockResults: Record<string, number> = {};
  const batchSize = 5;
  for (let i = 0; i < US_STOCK_UNIVERSE.length; i += batchSize) {
    const batch = US_STOCK_UNIVERSE.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(safeQuote));
    for (let j = 0; j < batch.length; j++) {
      if (results[j]) {
        stockResults[batch[j]] = Math.round(results[j]!.changePercent * 100) / 100;
      }
    }
  }

  return {
    close_price: gspc.price,
    change_percent: Math.round(gspc.changePercent * 100) / 100,
    direction: gspc.changePercent >= 0 ? "up" : "down",
    stock_results: stockResults,
  };
}

export async function getTWMarketClose(): Promise<MarketResult> {
  const twii = await safeQuote("^TWII");

  if (!twii) {
    return { close_price: 0, change_percent: 0, direction: "up" };
  }

  const stockResults: Record<string, number> = {};
  const batchSize = 5;
  for (let i = 0; i < TW_STOCK_UNIVERSE.length; i += batchSize) {
    const batch = TW_STOCK_UNIVERSE.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((s) => safeQuote(`${s}.TW`)));
    for (let j = 0; j < batch.length; j++) {
      if (results[j]) {
        stockResults[batch[j]] = Math.round(results[j]!.changePercent * 100) / 100;
      }
    }
  }

  return {
    close_price: twii.price,
    change_percent: Math.round(twii.changePercent * 100) / 100,
    direction: twii.changePercent >= 0 ? "up" : "down",
    stock_results: stockResults,
  };
}

export async function getCryptoClose(): Promise<MarketResult> {
  const btc = await safeQuote("BTC-USD");

  return {
    close_price: btc?.price ?? 0,
    change_percent: btc ? Math.round(btc.changePercent * 100) / 100 : 0,
    direction: (btc?.changePercent ?? 0) >= 0 ? "up" : "down",
  };
}

export async function getForexClose(): Promise<MarketResult> {
  const usdtwd = await safeQuote("TWD=X");

  return {
    close_price: usdtwd?.price ?? 0,
    change_percent: usdtwd ? Math.round(usdtwd.changePercent * 100) / 100 : 0,
    direction: (usdtwd?.changePercent ?? 0) >= 0 ? "up" : "down",
  };
}

export async function getGoldClose(): Promise<MarketResult> {
  const gold = await safeQuote("GC=F");

  return {
    close_price: gold?.price ?? 0,
    change_percent: gold ? Math.round(gold.changePercent * 100) / 100 : 0,
    direction: (gold?.changePercent ?? 0) >= 0 ? "up" : "down",
  };
}

// ─── STOCK QUOTE HELPERS ───────────────────────────────────

export async function getStockQuote(symbol: string): Promise<{ symbol: string; name: string; price: number; changePercent: number } | null> {
  const q = await safeQuote(symbol);
  if (!q) return null;
  return { symbol, name: q.name, price: q.price, changePercent: Math.round(q.changePercent * 100) / 100 };
}

export async function getTWStockQuote(stockNo: string): Promise<{ symbol: string; name: string; price: number; changePercent: number } | null> {
  const q = await safeQuote(`${stockNo}.TW`);
  if (!q) return null;
  return { symbol: stockNo, name: TW_STOCK_NAMES[stockNo] ?? q.name, price: q.price, changePercent: Math.round(q.changePercent * 100) / 100 };
}

export function getTWStockName(stockNo: string): string {
  return TW_STOCK_NAMES[stockNo] ?? stockNo;
}

// ─── SNAPSHOT DISPATCHER ───────────────────────────────────

export async function getMarketSnapshot(type: "us_market" | "tw_market" | "crypto" | "forex" | "gold"): Promise<MarketSnapshot> {
  switch (type) {
    case "us_market": return getUSMarketSnapshot();
    case "tw_market": return getTWMarketSnapshot();
    case "crypto": return getCryptoSnapshot();
    case "forex": return getForexSnapshot();
    case "gold": return getGoldSnapshot();
  }
}

export async function getMarketClose(type: "us_market" | "tw_market" | "crypto" | "forex" | "gold"): Promise<MarketResult> {
  switch (type) {
    case "us_market": return getUSMarketClose();
    case "tw_market": return getTWMarketClose();
    case "crypto": return getCryptoClose();
    case "forex": return getForexClose();
    case "gold": return getGoldClose();
  }
}
