import { createServerFn } from "@tanstack/react-start";

export type Bar = { t: number; o: number; h: number; l: number; c: number };
export type IntradayResult = {
  symbol: string;
  bars: Bar[];
  dailyBars: Bar[];
  fetchedAt: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// CNBC symbols for the tickers we chart (Yahoo throttles cloud IPs hard).
const CNBC_SYMBOL: Record<string, string> = {
  "^GSPC": ".SPX",
  "^DJI": ".DJI",
  "ES=F": "@SP.1",
  "NQ=F": "@ND.1",
  "YM=F": "@DJ.1",
  "RTY=F": ".RUT",
};

/** yyyyMMddHHmmss in UTC — CNBC's expected timestamp format. */
function stamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

async function fetchCnbcBars(
  symbol: string,
  startMs: number,
  endMs: number,
  intervalMinutes: number,
): Promise<Bar[]> {
  const s = CNBC_SYMBOL[symbol];
  if (!s) return [];
  const url =
    `https://ts-api.cnbc.com/harmony/app/charts/${stamp(startMs)}/${stamp(endMs)}.json` +
    `?symbol=${encodeURIComponent(s)}&intervalType=MINUTE&interval=${intervalMinutes}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`CNBC ${res.status}`);
  const json = (await res.json()) as any;
  const rows: any[] = json?.barData?.priceBars ?? [];
  const out: Bar[] = [];
  for (const r of rows) {
    const t = Number(r?.tradeTimeinMills);
    const o = parseFloat(r?.open), h = parseFloat(r?.high), l = parseFloat(r?.low), c = parseFloat(r?.close);
    if (!Number.isFinite(t) || ![o, h, l, c].every(Number.isFinite)) continue;
    out.push({ t, o, h, l, c });
  }
  return out.sort((a, b) => a.t - b.t);
}

const etDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Roll intraday bars up into one bar per ET calendar day (used for ATR). */
function toDailyBars(bars: Bar[]): Bar[] {
  const byDay = new Map<string, Bar>();
  for (const b of bars) {
    const day = etDayFmt.format(new Date(b.t));
    const cur = byDay.get(day);
    if (!cur) byDay.set(day, { ...b });
    else {
      cur.h = Math.max(cur.h, b.h);
      cur.l = Math.min(cur.l, b.l);
      cur.c = b.c;
    }
  }
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
}

// Yahoo fallback (works when its per-IP limiter lets us through).
const YAHOO_HOSTS = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"];

async function fetchYahoo(path: string): Promise<Bar[]> {
  let json: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`https://${YAHOO_HOSTS[attempt % YAHOO_HOSTS.length]}${path}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) {
      await sleep(250);
      continue;
    }
    json = await res.json();
    break;
  }
  const result = json?.chart?.result?.[0];
  if (!result) return [];
  const ts: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const out: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    out.push({ t: ts[i] * 1000, o, h, l, c });
  }
  return out;
}

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
      try {
        let bars: Bar[] = [];
        let dailyBars: Bar[] = [];
        try {
          bars = await fetchCnbcBars(data.symbol, now - 6 * 86_400_000, now, 5);
          const hourly = await fetchCnbcBars(data.symbol, now - 40 * 86_400_000, now, 60);
          dailyBars = toDailyBars(hourly);
        } catch (e) {
          console.warn("[intraday] CNBC failed", e);
        }
        if (!bars.length) {
          const s = encodeURIComponent(data.symbol);
          bars = await fetchYahoo(`/v8/finance/chart/${s}?interval=5m&range=5d`);
          if (!dailyBars.length) {
            await sleep(150);
            dailyBars = await fetchYahoo(`/v8/finance/chart/${s}?interval=1d&range=1mo`);
          }
        }
        // Empty means upstream throttling — keep the last good payload.
        if (!bars.length && cached) return cached.result;
        const result: IntradayResult = {
          symbol: data.symbol,
          bars,
          dailyBars: dailyBars.length ? dailyBars : (cached?.result.dailyBars ?? []),
          fetchedAt: new Date().toISOString(),
        };
        if (bars.length) cache.set(data.symbol, { at: Date.now(), result });
        return result;
      } catch (e) {
        if (cached) return cached.result;
        console.warn("[intraday] fetch failed", e);
        return { symbol: data.symbol, bars: [], dailyBars: [], fetchedAt: new Date().toISOString() };
      } finally {
        inflight.delete(data.symbol);
      }
    })();
    inflight.set(data.symbol, p);
    return p;
  });
