import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchIntraday } from "@/lib/intraday.functions";
import {
  computeSessionRanges,
  etTradingDay,
  etDateTimeToMs,
  type SessionRange,
} from "@/lib/session-analysis";
import { Loader2 } from "lucide-react";

const CHOICES = [
  { symbol: "^GSPC", label: "SPX" },
  { symbol: "ES=F", label: "ES" },
  { symbol: "NQ=F", label: "NQ" },
];

// Override colors for lunch (orange) and NY PM (purple).
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

function SymbolChart({ symbol, label }: { symbol: string; label: string }) {
  const day = etTradingDay();
  const { data, isLoading } = useQuery({
    queryKey: ["intraday", symbol],
    queryFn: () => fetchIntraday({ data: { symbol } }),
    refetchInterval: 60_000,
    staleTime: 45_000,
  });

  const analysis = useMemo(() => {
    if (!data) return null;
    const ranges = computeSessionRanges(data.bars, day);
    const chartStart = ranges.find((r) => r.key === "asia")!.startMs;
    const chartEnd = etDateTimeToMs(day, 16 * 60);
    return { ranges, chartStart, chartEnd };
  }, [data, day]);

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
          {/* Y grid + right-side price labels */}
          {priceTicks.map((v) => (
            <g key={`y${v}`}>
              <line
                x1={padL}
                x2={W - padR}
                y1={yScale(v)}
                y2={yScale(v)}
                stroke="currentColor"
                className="text-border"
                strokeWidth={0.5}
                opacity={0.4}
              />
              <text
                x={W - padR + 6}
                y={yScale(v) + 3}
                textAnchor="start"
                className="fill-muted-foreground"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
              >
                {fmt(v)}
              </text>
            </g>
          ))}

          {/* X time ticks */}
          {timeTicks.map((t) => (
            <g key={`x${t}`}>
              <line
                x1={xScale(t)}
                x2={xScale(t)}
                y1={padT}
                y2={H - padB}
                stroke="currentColor"
                className="text-border"
                strokeWidth={0.5}
                opacity={0.3}
              />
              <text
                x={xScale(t)}
                y={H - padB + 14}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
              >
                {fmtTime(t)}
              </text>
            </g>
          ))}

          {/* Session H/L horizontal segments (only across the session window) */}
          {analysis.ranges.map((r: SessionRange) => {
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
                {/* NYAM Opening Range (30m) in cyan */}
                {r.key === "nyam" && r.orHigh != null && r.orLow != null && (
                  <>
                    <line
                      x1={x1}
                      x2={xScale(Math.min(r.startMs + 30 * 60_000, analysis.chartEnd))}
                      y1={yScale(r.orHigh)}
                      y2={yScale(r.orHigh)}
                      stroke="#06b6d4"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                    <line
                      x1={x1}
                      x2={xScale(Math.min(r.startMs + 30 * 60_000, analysis.chartEnd))}
                      y1={yScale(r.orLow)}
                      y2={yScale(r.orLow)}
                      stroke="#06b6d4"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
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

          {/* Plot border */}
          <rect
            x={padL}
            y={padT}
            width={plotW}
            height={plotH}
            fill="none"
            stroke="currentColor"
            className="text-border"
            strokeWidth={0.75}
          />
        </svg>
      )}
    </div>
  );
}

export function SessionChart() {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Session Chart</h2>
        <p className="text-xs text-muted-foreground">
          Session highs &amp; lows with prices. NYAM Opening Range in cyan.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {CHOICES.map((c) => (
          <SymbolChart key={c.symbol} symbol={c.symbol} label={c.label} />
        ))}
      </div>
    </section>
  );
}