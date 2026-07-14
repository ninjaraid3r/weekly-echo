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

async function fetchOne(symbol: string, label: string): Promise<Quote> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const json = (await res.json()) as any;
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error("no meta");
    return {
      symbol,
      label,
      price: typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : null,
      prevClose:
        typeof meta.chartPreviousClose === "number"
          ? meta.chartPreviousClose
          : typeof meta.previousClose === "number"
            ? meta.previousClose
            : null,
      currency: meta.currency ?? null,
    };
  } catch (e) {
    return {
      symbol,
      label,
      price: null,
      prevClose: null,
      currency: null,
      error: e instanceof Error ? e.message : "failed",
    };
  }
}

export const fetchQuotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ groups: Array<{ name: string; quotes: Quote[] }>; fetchedAt: string }> => {
    const groups = await Promise.all(
      QUOTE_GROUPS.map(async (g) => ({
        name: g.name,
        quotes: await Promise.all(g.items.map((i) => fetchOne(i.symbol, i.label))),
      })),
    );
    return { groups, fetchedAt: new Date().toISOString() };
  },
);