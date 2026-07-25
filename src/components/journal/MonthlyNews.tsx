import { useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
} from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, PenLine, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type NewsEvent,
  type Impact,
  getDayJournal,
  setDayJournal,
} from "@/lib/journal-storage";
import { fmtDate } from "@/lib/week";
import { DayJournalDialog } from "./DayJournalDialog";
import { useFredEvents } from "@/lib/use-fred-events";
import { getMarketEvents } from "@/lib/market-events";

const IMPACT_VAR: Record<Impact, string> = {
  high: "var(--impact-high)",
  medium: "var(--impact-medium)",
  low: "var(--impact-low)",
};

export function MonthlyNews() {
  const [cursor, setCursor] = useState(() => new Date());
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [journalTick, setJournalTick] = useState(0);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const rangeStart = fmtDate(days[0]);
  const rangeEnd = fmtDate(days[days.length - 1]);
  const { events: news, loading, error, refetch } = useFredEvents(rangeStart, rangeEnd);

  const byDate = useMemo(() => {
    const m = new Map<string, NewsEvent[]>();
    for (const n of news) {
      const arr = m.get(n.date) ?? [];
      arr.push(n);
      m.set(n.date, arr);
    }
    return m;
  }, [news]);

  const journals = useMemo(() => {
    // depends on journalTick to refresh after save
    void journalTick;
    const m = new Map<string, boolean>();
    for (const d of days) {
      const k = fmtDate(d);
      if (getDayJournal(k)) m.set(k, true);
    }
    return m;
  }, [days, journalTick]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {format(cursor, "MMMM yyyy")}
          </h2>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            U.S. economic releases (FRED) — click any day to journal.
            {loading && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/80">
                <Loader2 className="size-3 animate-spin" /> syncing
              </span>
            )}
            {error && (
              <span className="text-xs text-destructive">FRED: {error}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
            title="Re-sync releases from FRED"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor((c) => addMonths(c, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="grid grid-cols-7 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = fmtDate(d);
            const events = byDate.get(key) ?? [];
            const counts: Record<Impact, number> = {
              high: 0,
              medium: 0,
              low: 0,
            };
            let critical = false;
            for (const e of events) {
              counts[e.impact]++;
              if (e.critical) critical = true;
            }
            const inMonth = isSameMonth(d, cursor);
            const today = isToday(d);
            const hasJournal = journals.has(key);
            const marketEvents = getMarketEvents(d);
            return (
              <button
                key={key}
                onClick={() => setOpenDate(key)}
                className={`relative text-left min-h-24 p-2 border-b border-r border-border transition-colors hover:bg-accent/40 ${
                  inMonth ? "bg-transparent" : "bg-background/40 opacity-60"
                } ${critical ? "ring-2 ring-inset ring-primary/70 bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full ${
                      today
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {format(d, "d")}
                  </span>
                  {hasJournal && (
                    <PenLine
                      className="size-3 text-primary"
                      aria-label="Has journal entry"
                    />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {events.map((e, idx) => (
                    <span
                      key={`${e.date}-${idx}`}
                      className="inline-block size-2.5 rounded-full ring-1 ring-black/10"
                      style={{
                        background: e.critical ? "#22c55e" : IMPACT_VAR[e.impact],
                      }}
                      title={`${e.critical ? "Key • " : ""}${e.impact} impact${e.name ? ` — ${e.name}` : ""}`}
                    />
                  ))}
                </div>
                {marketEvents.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {marketEvents.map((ev) => (
                      <div
                        key={ev.label}
                        className={`text-[10px] font-semibold leading-tight ${ev.className ?? "text-white"}`}
                      >
                        {ev.label}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Legend />

      <DayJournalDialog
        open={openDate !== null}
        onOpenChange={(o) => !o && setOpenDate(null)}
        date={openDate ?? ""}
        initialContent={openDate ? (getDayJournal(openDate)?.content ?? "") : ""}
        events={openDate ? (byDate.get(openDate) ?? []) : []}
        onSave={(content) => {
          if (!openDate) return;
          setDayJournal(openDate, content);
          setJournalTick((t) => t + 1);
        }}
      />
    </section>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <LegendDot color="var(--impact-high)" label="High impact" />
      <LegendDot color="var(--impact-medium)" label="Medium" />
      <LegendDot color="var(--impact-low)" label="Low" />
      <LegendDot color="#22c55e" label="Key release (FOMC, CPI, NFP, PPI…)" />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block size-3 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}