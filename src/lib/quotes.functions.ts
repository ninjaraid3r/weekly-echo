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

// CNBC's public quote service serves every symbol in one request and does not
// rate-limit shared cloud IPs the way Yahoo does. Yahoo stays as a fallback.
const CNBC_SYMBOL: Record<string, string> = {
  "^GSPC": ".SPX",
  "ES=F": "@SP.1",
  "NQ=F": "@ND.1",
  "^DJI": ".DJI",
  "RTY=F": ".RUT",
  "GC=F": "@GC.1",
  "SI=F": "@SI.1",
  "HG=F": "@HG.1",
  "PL=F": "@PL.1",
  "CL=F": "@CL.1",
  "NG=F": "@NG.1",
  "ZC=F": "@C.1",
  "ZS=F": "@S.1",
  "HE=F": "@LH.1",
  "BTC-USD": "BTC.CM=",
  "ETH-USD": "ETH.CM=",
  "SOL-USD": "SOL.CM=",
};

const cnbcSymbol = (s: string) => CNBC_SYMBOL[s] ?? s;

const quoteCache = new Map<string, { at: number; quote: Quote }>();
const QUOTE_TTL_MS = 20_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const toNum = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = parseFloat(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

async function fetchCnbcQuotes(): Promise<Map<string, Quote>> {
  const all = QUOTE_GROUPS.flatMap((g) => g.items);
  const symbols = all.map((i) => cnbcSymbol(i.symbol)).join("|");
  const url =
    "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol" +
    `?symbols=${encodeURIComponent(symbols)}&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`CNBC ${res.status}`);
  const json = (await res.json()) as any;
  const rows: any[] = json?.FormattedQuoteResult?.FormattedQuote ?? [];
  const bySymbol = new Map<string, any>();
  for (const r of rows) if (r?.symbol) bySymbol.set(String(r.symbol), r);

  const out = new Map<string, Quote>();
  for (const item of all) {
    const row = bySymbol.get(cnbcSymbol(item.symbol));
    const price = toNum(row?.last ?? row?.ExtendedMktQuote?.last);
    if (price == null) continue;
    out.set(item.symbol, {
      symbol: item.symbol,
      label: item.label,
      price,
      prevClose: toNum(row?.previous_day_closing),
      currency: row?.currencyCode ?? null,
    });
  }
  return out;
}

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