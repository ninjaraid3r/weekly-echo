import { lazy, Suspense, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchIntraday } from "@/lib/intraday.functions";
import { fetchOptionsSnapshot } from "@/lib/options.functions";
import { getStoredAvKey } from "@/lib/alphavantage-storage";
import {
  computeSessionRanges,
  etTradingDay,
  etDateTimeToMs,
  currentWeekWindow,
  type SessionRange,
} from "@/lib/session-analysis";
import { Button } from "@/components/ui/button";
import { Loader2, Activity, Ruler, BrickWall } from "lucide-react";
import type { PriceLine } from "./SpxLineChart";

export type OverlayToggles = {
  sessions: boolean;
  expectedMove: boolean;
  walls: boolean;
};

const SpxLineChart = lazy(() => import("./SpxLineChart"));

const FUTURES = [
  { symbol: "ES=F", label: "ES" },
  { symbol: "NQ=F", label: "NQ" },
  { symbol: "YM=F", label: "YM" },
];

const SESSION_COLOR: Record<string, string> = {
  asia: "#ef4444",
  london: "#3b82f6",
  nyam: "#22c55e",
  lunch: "#f97316",
  nypm: "#a855f7",
};

function fmt(n: number | null | undefined, d = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtTime(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

function useDayData(symbol: string, day: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["intraday", symbol],
    queryFn: () => fetchIntraday({ data: { symbol } }),
    refetchInterval: 60_000,
    staleTime: 45_000,
  });
  return useMemo(() => {
    if (!data) return { isLoading, analysis: null, bars: [] as typeof data extends never ? never : any[] };
    const ranges = computeSessionRanges(data.bars, day);
    const chartStart = ranges.find((r) => r.key === "asia")!.startMs;
    const chartEnd = etDateTimeToMs(day, 16 * 60);
    const bars = data.bars.filter((b) => b.t >= chartStart && b.t <= chartEnd);
    return { isLoading, analysis: { ranges, chartStart, chartEnd }, bars };
  }, [data, day, isLoading]);
}

/** Hourly bars spanning last Friday → this week's Friday, for the weekly candle view. */
function useWeekData(symbol: string) {
  const win = useMemo(() => currentWeekWindow(), []);
  const { data, isLoading } = useQuery({
    queryKey: ["intraday-week", symbol],
    queryFn: () => fetchIntraday({ data: { symbol, intervalMinutes: 60, days: 10 } }),
    refetchInterval: 120_000,
    staleTime: 90_000,
  });
  return useMemo(() => {
    const bars = (data?.bars ?? []).filter((b) => b.t >= win.startMs && b.t <= win.endMs);
    return { isLoading, bars, win };
  }, [data, isLoading, win]);
}

/** SPX — embedded lightweight line chart with session lines + options expected move. */
function SpxChart({ day, show, mode }: { day: string; show: OverlayToggles; mode: "today" | "week" }) {
  const dayData = useDayData("^GSPC", day);
  const weekData = useWeekData("^GSPC");
  const analysis = dayData.analysis;
  const bars = mode === "week" ? weekData.bars : dayData.bars;
  const isLoading = mode === "week" ? weekData.isLoading : dayData.isLoading;
  const avKey = typeof window !== "undefined" ? getStoredAvKey() : null;

  const { data: opts } = useQuery({
    queryKey: ["options-em", "SPY"],
    queryFn: () => fetchOptionsSnapshot({ data: { symbol: "SPY", apiKey: avKey ?? "" } }),
    enabled: !!avKey,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const lastClose = bars.length ? bars[bars.length - 1].c : null;

  // 1-day expected move: IV scaled to a single trading day (√(1/252)).
  const expectedMove = useMemo(() => {
    if (!opts || lastClose == null) return null;
    const exp = opts.expirations.find((e) => e.avgIV != null);
    if (!exp || exp.avgIV == null) return null;
    const pct = exp.avgIV * Math.sqrt(1 / 252);
    const move = lastClose * pct;
    if (!Number.isFinite(move) || move <= 0) return null;
    return { move, pct, expiration: exp.expiration, iv: exp.avgIV };
  }, [opts, lastClose]);

  // SPY chain strikes are ~1/10 of SPX — rescale walls onto the index.
  const walls = useMemo(() => {
    if (!opts || lastClose == null) return null;
    const exp = opts.expirations.find((e) => e.callWall != null || e.putWall != null);
    if (!exp) return null;
    const ref = exp.callWall ?? exp.putWall!;
    const scale = ref > 0 && lastClose / ref > 5 ? 10 : 1;
    return {
      call: exp.callWall != null ? exp.callWall * scale : null,
      put: exp.putWall != null ? exp.putWall * scale : null,
      expiration: exp.expiration,
    };
  }, [opts, lastClose]);

  const priceLines = useMemo<PriceLine[]>(() => {
    if (!analysis) return [];
    const lines: PriceLine[] = [];
    if (show.sessions) {
      for (const r of analysis.ranges as SessionRange[]) {
        const color = SESSION_COLOR[r.key] ?? "#64748b";
        if (r.high != null) lines.push({ price: r.high, color, title: `${r.label} H` });
        if (r.low != null) lines.push({ price: r.low, color, title: `${r.label} L` });
        if (r.key === "nyam") {
          if (r.orHigh != null) lines.push({ price: r.orHigh, color: "#06b6d4", title: "NYAM OR H", dashed: true });
          if (r.orLow != null) lines.push({ price: r.orLow, color: "#06b6d4", title: "NYAM OR L", dashed: true });
        }
      }
    }
    if (show.expectedMove && expectedMove && lastClose != null) {
      lines.push({ price: lastClose + expectedMove.move, color: "#7c3aed", title: "EM +", dashed: true });
      lines.push({ price: lastClose - expectedMove.move, color: "#7c3aed", title: "EM −", dashed: true });
    }
    if (show.walls && walls) {
      if (walls.call != null) lines.push({ price: walls.call, color: "#16a34a", title: "Call Wall", dashed: true });
      if (walls.put != null) lines.push({ price: walls.put, color: "#dc2626", title: "Put Wall", dashed: true });
    }
    return lines;
  }, [analysis, expectedMove, lastClose, show, walls]);

  const points = useMemo(
    () => bars.map((b: any) => ({ t: b.t, c: b.c, o: b.o, h: b.h, l: b.l })),
    [bars],
  );

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <span className="text-sm font-semibold">
          SPX {mode === "week" ? "· 1H candles · last Fri → Fri" : ""}
        </span>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          {isLoading && <Loader2 className="size-3 animate-spin" />}
          {expectedMove ? (
            <span style={{ color: "#7c3aed" }}>
              1-day expected move ±{(expectedMove.pct * 100).toFixed(2)}% (±{fmt(expectedMove.move)}) · IV{" "}
              {(expectedMove.iv * 100).toFixed(1)}%
            </span>
          ) : (
            <span>{avKey ? "Options data unavailable" : "Add an Alpha Vantage key in Settings for options expected move"}</span>
          )}
          {walls && (
            <span>
              <span style={{ color: "#16a34a" }}>Call {fmt(walls.call, 0)}</span> ·{" "}
              <span style={{ color: "#dc2626" }}>Put {fmt(walls.put, 0)}</span>
            </span>
          )}
        </div>
      </div>
      {points.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-xs text-muted-foreground">
          {isLoading ? "Loading…" : "No data"}
        </div>
      ) : (
        <ClientOnly fallback={<div className="h-[300px]" />}>
          <Suspense fallback={<div className="h-[300px]" />}>
            <SpxLineChart points={points} priceLines={priceLines} height={300} candles={mode === "week"} />
          </Suspense>
        </ClientOnly>
      )}
    </div>
  );
}

/** Futures — horizontal session H/L line charts (time on X, price on right Y). */
function SymbolChart({ symbol, label, day, show }: { symbol: string; label: string; day: string; show: OverlayToggles }) {
  const { analysis, isLoading } = useDayData(symbol, day);

  const W = 900;
  const H = 300;
  const padL = 8, padR = 68, padT = 14, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const priceExtent = useMemo(() => {
    if (!analysis) return null;
    let lo = Infinity, hi = -Infinity;
    for (const r of analysis.ranges) {
      if (r.high != null) hi = Math.max(hi, r.high);
      if (r.low != null) lo = Math.min(lo, r.low);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    const pad = (hi - lo) * 0.1 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [analysis]);

  const xScale = (t: number) => {
    if (!analysis) return 0;
    const { chartStart, chartEnd } = analysis;
    return padL + ((t - chartStart) / (chartEnd - chartStart)) * plotW;
  };
  const yScale = (p: number) => {
    if (!priceExtent) return 0;
    return padT + (1 - (p - priceExtent.lo) / (priceExtent.hi - priceExtent.lo)) * plotH;
  };

  const timeTicks = useMemo(() => {
    if (!analysis) return [];
    const ticks: number[] = [];
    const stepMs = 2 * 60 * 60 * 1000;
    let t = Math.ceil(analysis.chartStart / stepMs) * stepMs;
    while (t <= analysis.chartEnd) {
      ticks.push(t);
      t += stepMs;
    }
    return ticks;
  }, [analysis]);

  const priceTicks = useMemo(() => {
    if (!priceExtent) return [];
    const { lo, hi } = priceExtent;
    const range = hi - lo;
    const step = Math.pow(10, Math.floor(Math.log10(range / 5)));
    const err = (range / 5) / step;
    const niceStep = err >= 7.5 ? 10 * step : err >= 3 ? 5 * step : err >= 1.5 ? 2 * step : step;
    const ticks: number[] = [];
    let v = Math.ceil(lo / niceStep) * niceStep;
    while (v <= hi) {
      ticks.push(v);
      v += niceStep;
    }
    return ticks;
  }, [priceExtent]);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">{label}</span>
        {isLoading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
      </div>
      {!analysis || !priceExtent ? (
        <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">
          {isLoading ? "Loading…" : "No data"}
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[260px] block">
          {priceTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} stroke="currentColor" className="text-border" strokeWidth={0.5} opacity={0.4} />
              <text x={W - padR + 6} y={yScale(v) + 3} textAnchor="start" className="fill-muted-foreground" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                {fmt(v)}
              </text>
            </g>
          ))}

          {timeTicks.map((t) => (
            <g key={`x${t}`}>
              <line x1={xScale(t)} x2={xScale(t)} y1={padT} y2={H - padB} stroke="currentColor" className="text-border" strokeWidth={0.5} opacity={0.3} />
              <text x={xScale(t)} y={H - padB + 14} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                {fmtTime(t)}
              </text>
            </g>
          ))}

          {(show.sessions ? analysis.ranges : []).map((r: SessionRange) => {
            const color = SESSION_COLOR[r.key] ?? "#64748b";
            const x1 = xScale(Math.max(r.startMs, analysis.chartStart));
            const x2 = xScale(Math.min(r.endMs, analysis.chartEnd));
            return (
              <g key={r.key}>
                {r.high != null && (
                  <>
                    <line x1={x1} x2={x2} y1={yScale(r.high)} y2={yScale(r.high)} stroke={color} strokeWidth={1.5} />
                    <text x={x1 + 4} y={yScale(r.high) - 3} fill={color} style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                      {r.label} H {fmt(r.high)}
                    </text>
                  </>
                )}
                {r.low != null && (
                  <>
                    <line x1={x1} x2={x2} y1={yScale(r.low)} y2={yScale(r.low)} stroke={color} strokeWidth={1.5} />
                    <text x={x1 + 4} y={yScale(r.low) + 11} fill={color} style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                      {r.label} L {fmt(r.low)}
                    </text>
                  </>
                )}
                {r.key === "nyam" && r.orHigh != null && r.orLow != null && (
                  <>
                    <line x1={x1} x2={xScale(Math.min(r.startMs + 30 * 60_000, analysis.chartEnd))} y1={yScale(r.orHigh)} y2={yScale(r.orHigh)} stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="4 3" />
                    <line x1={x1} x2={xScale(Math.min(r.startMs + 30 * 60_000, analysis.chartEnd))} y1={yScale(r.orLow)} y2={yScale(r.orLow)} stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="4 3" />
                    <text x={x1 + 4} y={yScale(r.orHigh) - 3} fill="#06b6d4" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                      NYAM OR H {fmt(r.orHigh)}
                    </text>
                    <text x={x1 + 4} y={yScale(r.orLow) + 11} fill="#06b6d4" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                      NYAM OR L {fmt(r.orLow)}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          <rect x={padL} y={padT} width={plotW} height={plotH} fill="none" stroke="currentColor" className="text-border" strokeWidth={0.75} />
        </svg>
      )}
    </div>
  );
}

export function SessionChart() {
  const today = etTradingDay();
  const friday = lastFridayTradingDay();
  // Weekends have no bars — default to the last Friday's full trading day.
  const [day, setDay] = useState<string>(today === friday ? today : friday);
  const [show, setShow] = useState<OverlayToggles>({ sessions: true, expectedMove: true, pcSkew: false });
  const toggle = (k: keyof OverlayToggles) => setShow((s) => ({ ...s, [k]: !s[k] }));

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Session Chart</h2>
          <p className="text-xs text-muted-foreground">
            Time on X, price on Y. Session highs &amp; lows, NYAM Opening Range in cyan, SPX expected move from options.
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button size="sm" variant={show.sessions ? "default" : "outline"} onClick={() => toggle("sessions")}>
            <Ruler className="size-3.5" /> Session H/L
          </Button>
          <Button size="sm" variant={show.expectedMove ? "default" : "outline"} onClick={() => toggle("expectedMove")}>
            <Activity className="size-3.5" /> Expected Move
          </Button>
          <Button size="sm" variant={show.pcSkew ? "default" : "outline"} onClick={() => toggle("pcSkew")}>
            <Scale className="size-3.5" /> P/C Skew
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button size="sm" variant={day === today ? "default" : "outline"} onClick={() => setDay(today)}>
            Today
          </Button>
          <Button size="sm" variant={day === friday ? "default" : "outline"} onClick={() => setDay(friday)}>
            Friday ({friday.slice(5)})
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <SpxChart day={day} show={show} />
        {FUTURES.map((c) => (
          <SymbolChart key={c.symbol} symbol={c.symbol} label={c.label} day={day} show={show} />
        ))}
      </div>
    </section>
  );
}
