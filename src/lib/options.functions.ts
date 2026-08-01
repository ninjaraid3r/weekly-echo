import { createServerFn } from "@tanstack/react-start";

export type ExpiryStat = {
  expiration: string;
  callVolume: number;
  putVolume: number;
  callOI: number;
  putOI: number;
  pcVolume: number | null;
  pcOI: number | null;
  avgIV: number | null;
};

export type OptionsSnapshot = {
  symbol: string;
  asOf: string;
  live: boolean;
  callVolume: number;
  putVolume: number;
  callOI: number;
  putOI: number;
  pcVolume: number | null;
  pcOI: number | null;
  avgCallIV: number | null;
  avgPutIV: number | null;
  contracts: number;
  expirations: ExpiryStat[];
  note?: string;
};

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

const cache = new Map<string, { at: number; snap: OptionsSnapshot }>();
const TTL_MS = 60_000;

async function avFetch(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://www.alphavantage.co/query?${qs}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Alpha Vantage ${res.status}`);
  const json = (await res.json()) as any;
  if (json?.Note) throw new Error("Alpha Vantage rate limit reached — try again shortly.");
  if (json?.Information) throw new Error(String(json.Information));
  if (json?.["Error Message"]) throw new Error(String(json["Error Message"]));
  return json;
}

function summarize(symbol: string, rows: any[], live: boolean, note?: string): OptionsSnapshot {
  let callVolume = 0,
    putVolume = 0,
    callOI = 0,
    putOI = 0;
  let callIVSum = 0,
    callIVn = 0,
    putIVSum = 0,
    putIVn = 0;
  const byExp = new Map<string, ExpiryStat>();

  for (const r of rows) {
    const isPut = String(r.type ?? "").toLowerCase() === "put";
    const vol = num(r.volume);
    const oi = num(r.open_interest);
    const iv = num(r.implied_volatility);
    const exp = String(r.expiration ?? "");
    let e = byExp.get(exp);
    if (!e) {
      e = { expiration: exp, callVolume: 0, putVolume: 0, callOI: 0, putOI: 0, pcVolume: null, pcOI: null, avgIV: null };
      byExp.set(exp, e);
      ivByExp.set(exp, { sum: 0, n: 0 });
    }
    if (iv > 0) {
      const acc = ivByExp.get(exp)!;
      acc.sum += iv;
      acc.n++;
    }
    if (isPut) {
      putVolume += vol;
      putOI += oi;
      e.putVolume += vol;
      e.putOI += oi;
      if (iv > 0) {
        putIVSum += iv;
        putIVn++;
      }
    } else {
      callVolume += vol;
      callOI += oi;
      e.callVolume += vol;
      e.callOI += oi;
      if (iv > 0) {
        callIVSum += iv;
        callIVn++;
      }
    }
  }

  const expirations = [...byExp.values()]
    .map((e) => ({
      ...e,
      pcVolume: e.callVolume > 0 ? e.putVolume / e.callVolume : null,
      pcOI: e.callOI > 0 ? e.putOI / e.callOI : null,
      avgIV: (ivByExp.get(e.expiration)?.n ?? 0) > 0
        ? ivByExp.get(e.expiration)!.sum / ivByExp.get(e.expiration)!.n
        : null,
    }))
    .sort((a, b) => a.expiration.localeCompare(b.expiration))
    .slice(0, 8);

  return {
    symbol,
    asOf: new Date().toISOString(),
    live,
    callVolume,
    putVolume,
    callOI,
    putOI,
    pcVolume: callVolume > 0 ? putVolume / callVolume : null,
    pcOI: callOI > 0 ? putOI / callOI : null,
    avgCallIV: callIVn ? callIVSum / callIVn : null,
    avgPutIV: putIVn ? putIVSum / putIVn : null,
    contracts: rows.length,
    expirations,
    note,
  };
}

function prevBusinessDay(offset: number): string {
  const d = new Date();
  let moved = 0;
  while (moved < offset) {
    d.setUTCDate(d.getUTCDate() - 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) moved++;
  }
  return d.toISOString().slice(0, 10);
}

export const fetchOptionsSnapshot = createServerFn({ method: "GET" })
  .inputValidator((d: { symbol: string; apiKey: string }) => d)
  .handler(async ({ data }): Promise<OptionsSnapshot> => {
    const symbol = data.symbol.toUpperCase();
    if (!data.apiKey) throw new Error("No Alpha Vantage API key set. Add one in Settings.");
    const cached = cache.get(symbol);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.snap;

    let snap: OptionsSnapshot | null = null;
    let liveErr: string | null = null;

    try {
      const json = await avFetch({
        function: "REALTIME_OPTIONS",
        symbol,
        require_greeks: "true",
        apikey: data.apiKey,
      });
      const rows: any[] = Array.isArray(json?.data) ? json.data : [];
      if (rows.length) snap = summarize(symbol, rows, true);
    } catch (e) {
      liveErr = e instanceof Error ? e.message : String(e);
    }

    if (!snap) {
      for (let i = 1; i <= 4 && !snap; i++) {
        try {
          const json = await avFetch({
            function: "HISTORICAL_OPTIONS",
            symbol,
            date: prevBusinessDay(i),
            apikey: data.apiKey,
          });
          const rows: any[] = Array.isArray(json?.data) ? json.data : [];
          if (rows.length) {
            snap = summarize(
              symbol,
              rows,
              false,
              liveErr
                ? `Realtime unavailable (${liveErr}) — showing ${rows[0]?.date ?? "last"} close chain.`
                : `Showing ${rows[0]?.date ?? "last"} close chain.`,
            );
          }
        } catch (e) {
          liveErr = e instanceof Error ? e.message : String(e);
        }
      }
    }

    if (!snap) throw new Error(liveErr ?? `No options data returned for ${symbol}.`);
    cache.set(symbol, { at: Date.now(), snap });
    return snap;
  });

export const testAlphaVantage = createServerFn({ method: "GET" })
  .inputValidator((d: { apiKey: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; message: string }> => {
    try {
      const json = await avFetch({
        function: "GLOBAL_QUOTE",
        symbol: "SPY",
        apikey: data.apiKey,
      });
      const price = json?.["Global Quote"]?.["05. price"];
      if (!price) return { ok: false, message: "Connected, but no data returned. Check the key." };
      return { ok: true, message: `Connected — SPY last price ${price}.` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed." };
    }
  });
