import { createServerFn } from "@tanstack/react-start";

export type Bar = { t: number; o: number; h: number; l: number; c: number };
export type IntradayResult = {
  symbol: string;
  bars: Bar[];
  dailyBars: Bar[];
  fetchedAt: string;
};

async function fetchYahoo(url: string): Promise<Bar[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json = (await res.json()) as any;
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

export const fetchIntraday = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string }) => d)
  .handler(async ({ data }): Promise<IntradayResult> => {
    const s = encodeURIComponent(data.symbol);
    const [bars, dailyBars] = await Promise.all([
      fetchYahoo(
        `https://query1.finance.yahoo.com/v8/finance/chart/${s}?interval=5m&range=5d`,
      ),
      fetchYahoo(
        `https://query1.finance.yahoo.com/v8/finance/chart/${s}?interval=1d&range=1mo`,
      ),
    ]);
    return {
      symbol: data.symbol,
      bars,
      dailyBars,
      fetchedAt: new Date().toISOString(),
    };
  });