import { useMemo } from "react";
import { BarChart3, Newspaper, PenLine } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { currentWeekStart, weekDays, weekKey, fmtDate } from "@/lib/week";
import { loadEntries, loadNews, type Impact } from "@/lib/journal-storage";

export function WeeklySummary() {
  const weekStart = currentWeekStart();
  const key = weekKey(weekStart);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);

  const stats = useMemo(() => {
    const entries = loadEntries().filter((e) => e.weekKey === key);
    const weekDates = new Set(days.map((d) => fmtDate(d)));
    const news = loadNews().filter((n) => weekDates.has(n.date));

    const impactCounts: Record<Impact, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };
    let critical = 0;
    for (const n of news) {
      impactCounts[n.impact]++;
      if (n.critical) critical++;
    }

    return {
      entries: entries.length,
      news: news.length,
      impactCounts,
      critical,
    };
  }, [key, days]);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* Entry count */}
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <PenLine className="size-4" />
            </span>
            <div>
              <div className="text-2xl font-bold leading-none tracking-tight">
                {stats.entries}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mt-1">
                Entries
              </div>
            </div>
          </div>

          {/* Total news */}
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="grid place-items-center size-9 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Newspaper className="size-4" />
            </span>
            <div>
              <div className="text-2xl font-bold leading-none tracking-tight">
                {stats.news}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mt-1">
                Releases
              </div>
            </div>
          </div>

          {/* High impact */}
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="grid place-items-center size-9 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <BarChart3 className="size-4" />
            </span>
            <div>
              <div className="text-2xl font-bold leading-none tracking-tight">
                {stats.impactCounts.high}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mt-1">
                High Impact
              </div>
            </div>
          </div>

          {/* Medium impact */}
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="grid place-items-center size-9 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <BarChart3 className="size-4" />
            </span>
            <div>
              <div className="text-2xl font-bold leading-none tracking-tight">
                {stats.impactCounts.medium}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mt-1">
                Medium Impact
              </div>
            </div>
          </div>

          {/* Low impact */}
          <div className="flex items-center gap-3 px-5 py-4 col-span-2 sm:col-span-3 lg:col-span-1">
            <span className="grid place-items-center size-9 rounded-lg bg-yellow-400/10 text-yellow-300 border border-yellow-400/20">
              <BarChart3 className="size-4" />
            </span>
            <div>
              <div className="text-2xl font-bold leading-none tracking-tight">
                {stats.impactCounts.low}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mt-1">
                Low Impact
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
