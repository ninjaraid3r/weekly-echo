import { createServerFn } from "@tanstack/react-start";

export type Bar = { t: number; o: number; h: number; l: number; c: number };
export type IntradayResult = {
  symbol: string;
  bars: Bar[];
  dailyBars: Bar[];
  fetchedAt: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchYahoo(path: string): Promise<Bar[]> {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  let lastErr = "failed";
  let json: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = `https://${hosts[attempt % hosts.length]}${path}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (res.status === 429) {
      lastErr = "Yahoo 429";
      await sleep(500 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      lastErr = `Yahoo ${res.status}`;
      await sleep(300 * (attempt + 1));
      continue;
    }
    json = await res.json();
    break;
  }
  // Never throw on upstream rate limiting — callers fall back to cache/empty.
  if (!json) {
    console.warn(`[intraday] ${lastErr}`);
    return [];
  }
  const result = json?.chart?.result?.[0];
  if (!result) return [];
  const ts: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const o: (number | null)[] = q.open ?? [];
  const h: (number | null)[] = q.high ?? [];
  const l: (number | null)[] = q.low ?? [];
  const c: (number | null)[] = q.close ?? [];
  const out: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (o[i] == null || h[i] == null || l[i] == null || c[i] == null) continue;
    out.push({
      t: ts[i] * 1000,
      o: o[i] as number,
      h: h[i] as number,
      l: l[i] as number,
      c: c[i] as number,
    });
  }
  return out;
}

// Per-symbol cache: intraday refreshes at most once/2min, daily once/hour.
const cache = new Map<string, { at: number; result: IntradayResult }>();
const inflight = new Map<string, Promise<IntradayResult>>();
const INTRADAY_TTL_MS = 120_000;

export const fetchIntraday = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(async ({ data }): Promise<IntradayResult> => {
    const now = Date.now();
    const cached = cache.get(data.symbol);
    if (cached && now - cached.at < INTRADAY_TTL_MS) return cached.result;
    const existing = inflight.get(data.symbol);
    if (existing) return existing;

    const p = (async () => {
      const s = encodeURIComponent(data.symbol);
      try {
        // Sequenced (not parallel) to reduce 429 pressure
        const bars = await fetchYahoo(`/v8/finance/chart/${s}?interval=5m&range=5d`);
        await sleep(150);
        const dailyBars = await fetchYahoo(`/v8/finance/chart/${s}?interval=1d&range=1mo`);
        const result: IntradayResult = {
          symbol: data.symbol,
          bars,
          dailyBars,
          fetchedAt: new Date().toISOString(),
        };
        cache.set(data.symbol, { at: Date.now(), result });
        return result;
      } catch (e) {
        if (cached) return cached.result; // serve stale on error
        console.warn("[intraday] fetch failed", e);
        return { symbol: data.symbol, bars: [], dailyBars: [], fetchedAt: new Date().toISOString() };
      } finally {
        inflight.delete(data.symbol);
      }
    })();
    inflight.set(data.symbol, p);
    return p;
  });