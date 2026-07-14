import { useQuery } from "@tanstack/react-query";
import { fetchQuotes, type Quote } from "@/lib/quotes.functions";
import { TrendingDown, TrendingUp, Minus, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function QuoteCard({ q }: { q: Quote }) {
  const change =
    q.price != null && q.prevClose != null && q.prevClose !== 0
      ? ((q.price - q.prevClose) / q.prevClose) * 100
      : null;
  const dir = change == null ? 0 : change > 0.001 ? 1 : change < -0.001 ? -1 : 0;
  const color =
    dir > 0 ? "text-emerald-600" : dir < 0 ? "text-red-600" : "text-muted-foreground";
  const Icon = dir > 0 ? TrendingUp : dir < 0 ? TrendingDown : Minus;
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 min-w-[112px]">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-semibold tracking-wide">{q.label}</span>
        <Icon className={`size-3 ${color}`} />
      </div>
      <div className="mt-0.5 text-sm font-mono font-semibold tabular-nums">
        {q.price != null
          ? q.price.toLocaleString(undefined, {
              maximumFractionDigits: q.price >= 1000 ? 2 : 4,
              minimumFractionDigits: 2,
            })
          : "—"}
      </div>
      <div className={`text-[10px] font-mono tabular-nums ${color}`}>
        {change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}
      </div>
    </div>
  );
}

export function TickerGrid() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => fetchQuotes(),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Live Quotes</h2>
          <p className="text-xs text-muted-foreground">
            Auto-refresh every 30s{data?.fetchedAt ? ` · updated ${new Date(data.fetchedAt).toLocaleTimeString()}` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>
      {isLoading && !data ? (
        <div className="text-sm text-muted-foreground">Loading quotes…</div>
      ) : (
        <div className="space-y-4">
          {data?.groups.map((g) => (
            <div key={g.name}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                {g.name}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
                {g.quotes.map((q) => (
                  <QuoteCard key={q.symbol} q={q} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}