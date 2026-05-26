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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type NewsEvent,
  type Impact,
  loadNews,
  saveNews,
  uid,
} from "@/lib/journal-storage";
import { fmtDate } from "@/lib/week";
import { NewsDialog } from "./NewsDialog";

const IMPACT_VAR: Record<Impact, string> = {
  high: "var(--impact-high)",
  medium: "var(--impact-medium)",
  low: "var(--impact-low)",
};

export function MonthlyNews() {
  const [cursor, setCursor] = useState(() => new Date());
  const [news, setNews] = useState<NewsEvent[]>(() => loadNews());
  const [openDate, setOpenDate] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const byDate = useMemo(() => {
    const m = new Map<string, NewsEvent[]>();
    for (const n of news) {
      const arr = m.get(n.date) ?? [];
      arr.push(n);
      m.set(n.date, arr);
    }
    return m;
  }, [news]);

  const persist = (next: NewsEvent[]) => {
    saveNews(next);
    setNews(next);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {format(cursor, "MMMM yyyy")}
          </h2>
          <p className="text-sm text-muted-foreground">
            U.S. economic releases — click any day to log events.
          </p>
        </div>
        <div className="flex items-center gap-1">
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
                  {critical && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-primary">
                      Key
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(["high", "medium", "low"] as Impact[]).map((imp) =>
                    counts[imp] > 0 ? (
                      <span
                        key={imp}
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-background"
                        style={{ background: IMPACT_VAR[imp] }}
                        title={`${counts[imp]} ${imp} impact`}
                      >
                        <span className="size-1.5 rounded-full bg-background/80" />
                        {counts[imp]}
                      </span>
                    ) : null
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Legend />

      <NewsDialog
        open={openDate !== null}
        onOpenChange={(o) => !o && setOpenDate(null)}
        date={openDate ?? ""}
        events={openDate ? (byDate.get(openDate) ?? []) : []}
        onAdd={({ name, impact, critical }) => {
          if (!openDate) return;
          persist([
            ...news,
            { id: uid(), date: openDate, name, impact, critical },
          ]);
        }}
        onRemove={(id) => persist(news.filter((n) => n.id !== id))}
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
      <span className="flex items-center gap-2">
        <span className="inline-block size-3 rounded-sm ring-2 ring-primary bg-primary/10" />
        Key release (FOMC, CPI, NFP, PPI...)
      </span>
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