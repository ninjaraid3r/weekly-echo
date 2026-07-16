import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchIntraday } from "@/lib/intraday.functions";
import {
  computeSessionRanges,
  etTradingDay,
  etDateTimeToMs,
  computeAtr,
  priorClose,
  getManualExpectedMove,
  setManualExpectedMove,
} from "@/lib/session-analysis";
import { Loader2, RefreshCw, Pencil, X } from "lucide-react";

type SymbolChoice = { symbol: string; label: string };

const CHOICES: SymbolChoice[] = [
  { symbol: "^GSPC", label: "SPX" },
  { symbol: "ES=F", label: "ES" },
  { symbol: "NQ=F", label: "NQ" },
];

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

export function SessionChart() {
  const [symbolIdx, setSymbolIdx] = useState(0);
  const choice = CHOICES[symbolIdx];
  const day = etTradingDay();
  const [editingEm, setEditingEm] = useState(false);
  const [emInput, setEmInput] = useState("");
  const [manualEm, setManualEmState] = useState<number | null>(null);

  useEffect(() => {
    setManualEmState(getManualExpectedMove(choice.symbol, day));
    setEditingEm(false);
  }, [choice.symbol, day]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["intraday", choice.symbol],
    queryFn: () => fetchIntraday({ data: { symbol: choice.symbol } }),
    refetchInterval: 60_000,
    staleTime: 45_000,
  });

  const analysis = useMemo(() => {
    if (!data) return null;
    const ranges = computeSessionRanges(data.bars, day);
    const asia = ranges.find((r) => r.key === "asia")!;
    const london = ranges.find((r) => r.key === "london")!;
    const chartStart = asia.startMs;
    const chartEnd = etDateTimeToMs(day, 16 * 60);
    const visible = data.bars.filter((b) => b.t >= chartStart && b.t <= chartEnd);
    const atr = computeAtr(data.dailyBars);
    const pc = priorClose(data.dailyBars);
    const autoEm = atr;
    const em = manualEm ?? autoEm;
    return { ranges, asia, london, chartStart, chartEnd, visible, atr, priorClose: pc, autoEm, em };
  }, [data, day, manualEm]);

  const saveEm = () => {
    const n = emInput.trim() === "" ? null : Number(emInput);
    setManualExpectedMove(choice.symbol, day, n);
    setManualEmState(n && Number.isFinite(n) ? n : null);
    setEditingEm(false);
  };
  const clearEm = () => {
    setManualExpectedMove(choice.symbol, day, null);
    setManualEmState(null);
    setEmInput("");
    setEditingEm(false);
  };

  // SVG dims
  const W = 900;
  const H = 340;
  const padL = 56, padR = 12, padT = 12, padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const priceExtent = useMemo(() => {
    if (!analysis) return null;
    let lo = Infinity, hi = -Infinity;
    for (const b of analysis.visible) {
      if (b.l < lo) lo = b.l;
      if (b.h > hi) hi = b.h;
    }
    if (analysis.asia.hasData) { lo = Math.min(lo, analysis.asia.low!); hi = Math.max(hi, analysis.asia.high!); }
    if (analysis.london.hasData) { lo = Math.min(lo, analysis.london.low!); hi = Math.max(hi, analysis.london.high!); }
    if (analysis.em != null && analysis.priorClose != null) {
      lo = Math.min(lo, analysis.priorClose - analysis.em);
      hi = Math.max(hi, analysis.priorClose + analysis.em);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    const pad = (hi - lo) * 0.06 || 1;
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

  // Time axis ticks — every 3 hours
  const timeTicks = useMemo(() => {
    if (!analysis) return [];
    const ticks: number[] = [];
    const stepMs = 3 * 60 * 60 * 1000;
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
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Session Chart</h2>
          <p className="text-xs text-muted-foreground">
            OHLC bars with Asia (red), London (blue) highs/lows and 1-day expected move.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {CHOICES.map((c, i) => (
              <button
                key={c.symbol}
                onClick={() => setSymbolIdx(i)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  i === symbolIdx ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            {isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        {isLoading && !data ? (
          <div className="h-[340px] flex items-center justify-center text-sm text-muted-foreground">
            Loading intraday data…
          </div>
        ) : !analysis || !priceExtent ? (
          <div className="h-[340px] flex items-center justify-center text-sm text-muted-foreground">
            No intraday data available for {choice.label}.
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] mb-2">
              <LegendSwatch color="#ef4444" label={`Asia H/L  ${fmt(analysis.asia.high)} / ${fmt(analysis.asia.low)}`} />
              <LegendSwatch color="#3b82f6" label={`London H/L  ${fmt(analysis.london.high)} / ${fmt(analysis.london.low)}`} />
              <LegendSwatch color="#a855f7" dashed label={`EM ±${fmt(analysis.em)}${manualEm != null ? " (manual)" : " (ATR)"}${analysis.priorClose != null ? `  from ${fmt(analysis.priorClose)}` : ""}`} />
              <div className="ml-auto flex items-center gap-1">
                {editingEm ? (
                  <>
                    <input
                      autoFocus
                      value={emInput}
                      onChange={(e) => setEmInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEm(); if (e.key === "Escape") setEditingEm(false); }}
                      placeholder={analysis.autoEm ? fmt(analysis.autoEm) : "e.g. 45"}
                      className="w-24 rounded border border-input bg-background px-2 py-1 text-xs"
                    />
                    <button onClick={saveEm} className="rounded border border-border px-2 py-1 text-xs hover:bg-accent">Save</button>
                    {manualEm != null && (
                      <button onClick={clearEm} className="rounded border border-border px-2 py-1 text-xs hover:bg-accent" title="Use ATR">
                        <X className="size-3" />
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => { setEmInput(manualEm != null ? String(manualEm) : ""); setEditingEm(true); }}
                    className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
                    title="Override expected move for today"
                  >
                    <Pencil className="size-3" /> Override EM
                  </button>
                )}
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[340px] min-w-[720px] block">
                {/* Y grid + labels */}
                {priceTicks.map((v) => (
                  <g key={`y${v}`}>
                    <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} stroke="currentColor" className="text-border" strokeWidth={0.5} opacity={0.5} />
                    <text x={padL - 6} y={yScale(v) + 3} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                      {fmt(v)}
                    </text>
                  </g>
                ))}

                {/* X ticks */}
                {timeTicks.map((t) => (
                  <g key={`x${t}`}>
                    <line x1={xScale(t)} x2={xScale(t)} y1={padT} y2={H - padB} stroke="currentColor" className="text-border" strokeWidth={0.5} opacity={0.35} />
                    <text x={xScale(t)} y={H - padB + 14} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}>
                      {fmtTime(t)}
                    </text>
                  </g>
                ))}

                {/* Session shading */}
                {analysis.ranges.map((r) => (
                  <rect
                    key={`sh${r.key}`}
                    x={xScale(Math.max(r.startMs, analysis.chartStart))}
                    y={padT}
                    width={Math.max(0, xScale(Math.min(r.endMs, analysis.chartEnd)) - xScale(Math.max(r.startMs, analysis.chartStart)))}
                    height={plotH}
                    fill={r.color}
                    opacity={0.04}
                  />
                ))}

                {/* OHLC bars (thin) */}
                {analysis.visible.map((b) => {
                  const x = xScale(b.t + 2.5 * 60_000); // center of 5m bar
                  const yH = yScale(b.h);
                  const yL = yScale(b.l);
                  const yO = yScale(b.o);
                  const yC = yScale(b.c);
                  const up = b.c >= b.o;
                  const stroke = up ? "#10b981" : "#ef4444";
                  const barW = Math.max(1.5, (plotW / analysis.visible.length) * 0.6);
                  return (
                    <g key={b.t} stroke={stroke} strokeWidth={1}>
                      <line x1={x} x2={x} y1={yH} y2={yL} />
                      <line x1={x - barW / 2} x2={x} y1={yO} y2={yO} />
                      <line x1={x} x2={x + barW / 2} y1={yC} y2={yC} />
                    </g>
                  );
                })}

                {/* Asia High/Low */}
                {analysis.asia.high != null && (
                  <HLine y={yScale(analysis.asia.high)} x1={padL} x2={W - padR} color="#ef4444" label={`Asia H ${fmt(analysis.asia.high)}`} />
                )}
                {analysis.asia.low != null && (
                  <HLine y={yScale(analysis.asia.low)} x1={padL} x2={W - padR} color="#ef4444" label={`Asia L ${fmt(analysis.asia.low)}`} />
                )}
                {/* London High/Low */}
                {analysis.london.high != null && (
                  <HLine y={yScale(analysis.london.high)} x1={padL} x2={W - padR} color="#3b82f6" label={`London H ${fmt(analysis.london.high)}`} />
                )}
                {analysis.london.low != null && (
                  <HLine y={yScale(analysis.london.low)} x1={padL} x2={W - padR} color="#3b82f6" label={`London L ${fmt(analysis.london.low)}`} />
                )}
                {/* Expected move bands */}
                {analysis.em != null && analysis.priorClose != null && (
                  <>
                    <HLine y={yScale(analysis.priorClose + analysis.em)} x1={padL} x2={W - padR} color="#a855f7" dashed label={`EM+  ${fmt(analysis.priorClose + analysis.em)}`} />
                    <HLine y={yScale(analysis.priorClose - analysis.em)} x1={padL} x2={W - padR} color="#a855f7" dashed label={`EM−  ${fmt(analysis.priorClose - analysis.em)}`} />
                    <HLine y={yScale(analysis.priorClose)} x1={padL} x2={W - padR} color="#a855f7" dashed opacity={0.35} />
                  </>
                )}

                {/* Plot border */}
                <rect x={padL} y={padT} width={plotW} height={plotH} fill="none" stroke="currentColor" className="text-border" strokeWidth={0.75} />
              </svg>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function LegendSwatch({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="6" className="shrink-0">
        <line x1="0" y1="3" x2="18" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "3 3" : undefined} />
      </svg>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function HLine({
  y, x1, x2, color, label, dashed, opacity = 0.9,
}: { y: number; x1: number; x2: number; color: string; label?: string; dashed?: boolean; opacity?: number }) {
  return (
    <g>
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={color} strokeWidth={1.25} strokeDasharray={dashed ? "5 4" : undefined} opacity={opacity} />
      {label && (
        <text x={x2 - 4} y={y - 3} textAnchor="end" style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }} fill={color}>
          {label}
        </text>
      )}
    </g>
  );
}