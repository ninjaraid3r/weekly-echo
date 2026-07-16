import { useQuery } from "@tanstack/react-query";
import { fetchIntraday } from "@/lib/intraday.functions";
import { computeSessionRanges, etTradingDay } from "@/lib/session-analysis";
import { Activity, Loader2 } from "lucide-react";

const SYMBOLS = [
  { symbol: "^GSPC", label: "SPX" },
  { symbol: "ES=F", label: "ES" },
  { symbol: "NQ=F", label: "NQ" },
];

function fmt(n: number | null, d = 2): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function timeStr(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

function SymbolBlock({ symbol, label }: { symbol: string; label: string }) {
  const day = etTradingDay();
  const { data, isLoading } = useQuery({
    queryKey: ["intraday", symbol],
    queryFn: () => fetchIntraday({ data: { symbol } }),
    refetchInterval: 60_000,
    staleTime: 45_000,
  });
  const ranges = data ? computeSessionRanges(data.bars, day) : [];
  const now = Date.now();

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        {isLoading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
      </div>
      <ul className="space-y-1.5">
        {ranges.map((r) => {
          const started = now >= r.startMs;
          const done = now >= r.endMs;
          const dot = done ? "bg-muted-foreground/40" : started ? "" : "bg-transparent border border-dashed border-border";
          return (
            <li
              key={r.key}
              className="rounded-md border border-border/70 bg-background/50 px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`size-2 rounded-full shrink-0 ${dot}`}
                    style={started && !done ? { background: r.color, boxShadow: `0 0 6px ${r.color}` } : started ? undefined : undefined}
                  />
                  <span className="text-[11px] font-semibold" style={{ color: r.color }}>{r.label}</span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {timeStr(r.startMs)}–{timeStr(r.endMs)}
                  </span>
                </div>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 text-[10px] font-mono tabular-nums">
                <div>
                  <div className="text-muted-foreground">Session H/L</div>
                  <div>
                    <span className="text-emerald-600">{fmt(r.high)}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-red-600">{fmt(r.low)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">OR (30m) H/L</div>
                  <div>
                    <span className="text-emerald-600">{fmt(r.orHigh)}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-red-600">{fmt(r.orLow)}</span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SessionRangesCard() {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <h2 className="text-xl font-semibold tracking-tight">Session Ranges</h2>
        <span className="text-xs text-muted-foreground">
          Full range + first-30m opening range per session
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SYMBOLS.map((s) => (
          <SymbolBlock key={s.symbol} {...s} />
        ))}
      </div>
    </section>
  );
}