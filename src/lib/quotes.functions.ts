import { createServerFn } from "@tanstack/react-start";

export type Quote = {
  symbol: string;
  label: string;
  price: number | null;
  prevClose: number | null;
  currency: string | null;
  error?: string;
};

export type QuoteGroup = {
  name: string;
  items: Array<{ symbol: string; label: string }>;
};

export const QUOTE_GROUPS: QuoteGroup[] = [
  {
    name: "Indices & Futures",
    items: [
      { symbol: "^GSPC", label: "SPX" },
      { symbol: "ES=F", label: "ES1!" },
      { symbol: "NQ=F", label: "NQ1!" },
      { symbol: "^DJI", label: "DOW" },
      { symbol: "RTY=F", label: "RTY" },
    ],
  },
  {
    name: "Commodities",
    items: [
      { symbol: "GC=F", label: "Gold" },
      { symbol: "SI=F", label: "Silver" },
      { symbol: "HG=F", label: "Copper" },
      { symbol: "PL=F", label: "Platinum" },
      { symbol: "CL=F", label: "Oil" },
      { symbol: "NG=F", label: "Nat Gas" },
      { symbol: "ZC=F", label: "Corn" },
      { symbol: "ZS=F", label: "Grains" },
      { symbol: "HE=F", label: "Lean Hogs" },
    ],
  },
  {
    name: "Equities",
    items: [
      { symbol: "NVDA", label: "NVDA" },
      { symbol: "TSLA", label: "TSLA" },
      { symbol: "MSFT", label: "MSFT" },
      { symbol: "AAPL", label: "AAPL" },
      { symbol: "AMZN", label: "AMZN" },
      { symbol: "GOOGL", label: "GOOGL" },
      { symbol: "SPCX", label: "SPCX" },
    ],
  },
  {
    name: "Crypto",
    items: [
      { symbol: "BTC-USD", label: "BTC" },
      { symbol: "ETH-USD", label: "ETH" },
      { symbol: "SOL-USD", label: "SOL" },
    ],
  },
];

// Module-level cache — the worker instance keeps quotes warm so we don't
// hammer Yahoo (which 429s from shared cloud IPs quickly).
const quoteCache = new Map<string, { at: number; quote: Quote }>();
const QUOTE_TTL_MS = 45_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// query2 tolerates shared cloud IPs much better than query1 — try it first.
const HOSTS = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"];

async function fetchOneFresh(symbol: string, label: string): Promise<Quote> {
  let lastErr = "failed";
  for (let attempt = 0; attempt < 4; attempt++) {
    const host = HOSTS[attempt % HOSTS.length];
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Accept: "application/json",
        },
      });
      if (res.status === 429) {
        lastErr = "429";
        await sleep(400 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as any;
      const meta = json?.chart?.result?.[0]?.meta;
      if (!meta) throw new Error("no meta");
      return {
        symbol,
        label,
        price:
          typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : null,
        prevClose:
          typeof meta.chartPreviousClose === "number"
            ? meta.chartPreviousClose
            : typeof meta.previousClose === "number"
              ? meta.previousClose
              : null,
        currency: meta.currency ?? null,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "failed";
    }
  }
  return { symbol, label, price: null, prevClose: null, currency: null, error: lastErr };
}

async function fetchOne(symbol: string, label: string): Promise<Quote> {
  const cached = quoteCache.get(symbol);
  const now = Date.now();
  if (cached && now - cached.at < QUOTE_TTL_MS) return cached.quote;
  const fresh = await fetchOneFresh(symbol, label);
  // If fetch failed but we have a stale cached quote, prefer it (mark stale).
  if (fresh.error && cached) {
    return { ...cached.quote, error: `stale (${fresh.error})` };
  }
  if (!fresh.error) quoteCache.set(symbol, { at: now, quote: fresh });
  return fresh;
}

let quotesInflight: Promise<{ groups: Array<{ name: string; quotes: Quote[] }>; fetchedAt: string }> | null = null;

export const fetchQuotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ groups: Array<{ name: string; quotes: Quote[] }>; fetchedAt: string }> => {
    if (quotesInflight) return quotesInflight;
    quotesInflight = (async () => {
      const groups: Array<{ name: string; quotes: Quote[] }> = [];
      for (const g of QUOTE_GROUPS) {
        // Small concurrency keeps the whole grid under a few seconds
        // without bursting hard enough to trip Yahoo's limiter.
        const quotes: Quote[] = [];
        for (let i = 0; i < g.items.length; i += 3) {
          const chunk = g.items.slice(i, i + 3);
          quotes.push(...(await Promise.all(chunk.map((it) => fetchOne(it.symbol, it.label)))));
          await sleep(80);
        }
        groups.push({ name: g.name, quotes });
      }
      return { groups, fetchedAt: new Date().toISOString() };
    })();
    try {
      return await quotesInflight;
    } finally {
      quotesInflight = null;
    }
  },
);