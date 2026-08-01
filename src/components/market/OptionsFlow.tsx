import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchOptionsSnapshot } from "@/lib/options.functions";
import { getStoredAvKey, OPTIONS_SYMBOLS } from "@/lib/alphavantage-storage";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Scale, AlertCircle } from "lucide-react";

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const ratio = (n: number | null) => (n == null ? "—" : n.toFixed(2));

function ratioTone(r: number | null) {
  if (r == null) return "text-muted-foreground";
  if (r > 1.1) return "text-red-600";
  if (r < 0.8) return "text-emerald-600";
  return "text-amber-600";
}

export function OptionsFlow() {
  const [symbol, setSymbol] = useState<string>("SPY");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setApiKey(getStoredAvKey());
    setReady(true);
  }, []);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["options", symbol, !!apiKey],
    queryFn: () => fetchOptionsSnapshot({ data: { symbol, apiKey: apiKey! } }),
    enabled: ready && !!apiKey,
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: false,
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Scale className="size-5" />
            Options &amp; Put/Call Ratio
          </h2>
          <p className="text-xs text-muted-foreground">
            Alpha Vantage options chain
            {data ? ` · ${data.live ? "realtime" : "last close"} · updated ${new Date(data.asOf).toLocaleTimeString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 rounded-lg border border-border p-1">
            {OPTIONS_SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  s === symbol ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching || !apiKey}>
            {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sync
          </Button>
        </div>
      </div>

      {!apiKey && ready ? (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm flex items-start gap-2">
          <AlertCircle className="size-4 mt-0.5 shrink-0 text-amber-600" />
          <span>
            No Alpha Vantage API key set.{" "}
            <Link to="/settings" className="text-primary underline underline-offset-2">
              Add one in Settings
            </Link>{" "}
            to sync options data and put/call ratios.
          </span>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          {error instanceof Error ? error.message : String(error)}
        </div>
      ) : isLoading || !data ? (
        <div className="text-sm text-muted-foreground">Loading options chain…</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">P/C — Volume</div>
              <div className={`text-2xl font-mono font-semibold tabular-nums ${ratioTone(data.pcVolume)}`}>
                {ratio(data.pcVolume)}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {fmt(data.putVolume)}P / {fmt(data.callVolume)}C
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">P/C — Open Interest</div>
              <div className={`text-2xl font-mono font-semibold tabular-nums ${ratioTone(data.pcOI)}`}>
                {ratio(data.pcOI)}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {fmt(data.putOI)}P / {fmt(data.callOI)}C
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg IV (C / P)</div>
              <div className="text-2xl font-mono font-semibold tabular-nums">
                {data.avgCallIV != null ? `${(data.avgCallIV * 100).toFixed(1)}%` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                puts {data.avgPutIV != null ? `${(data.avgPutIV * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Contracts</div>
              <div className="text-2xl font-mono font-semibold tabular-nums">{fmt(data.contracts)}</div>
              <div className="text-[11px] text-muted-foreground font-mono">{data.symbol} chain</div>
            </div>
          </div>

          {data.note && <p className="text-[11px] text-muted-foreground">{data.note}</p>}

          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Expiration</th>
                  <th className="text-right px-3 py-2 font-medium">Call Vol</th>
                  <th className="text-right px-3 py-2 font-medium">Put Vol</th>
                  <th className="text-right px-3 py-2 font-medium">P/C Vol</th>
                  <th className="text-right px-3 py-2 font-medium">P/C OI</th>
                </tr>
              </thead>
              <tbody>
                {data.expirations.map((e) => (
                  <tr key={e.expiration} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{e.expiration}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmt(e.callVolume)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{fmt(e.putVolume)}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${ratioTone(e.pcVolume)}`}>
                      {ratio(e.pcVolume)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${ratioTone(e.pcOI)}`}>
                      {ratio(e.pcOI)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
