import { createFileRoute } from "@tanstack/react-router";
import { WeeklyKanban } from "@/components/journal/WeeklyKanban";
import { MonthlyNews } from "@/components/journal/MonthlyNews";
import { WeeklySummary } from "@/components/journal/WeeklySummary";
import { RssFeed } from "@/components/dashboard/RssFeed";
import { TickerGrid } from "@/components/market/TickerGrid";
import { SessionChart } from "@/components/market/SessionChart";
import { SessionRangesCard } from "@/components/market/SessionRangesCard";
import { LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Weekly Journal + U.S. News Calendar" },
      {
        name: "description",
        content:
          "Journal your week in a kanban view and track high, medium, and low impact U.S. economic news releases.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        className="absolute inset-x-0 top-0 h-64 -z-10 opacity-60 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, color-mix(in oklch, var(--primary) 25%, transparent), transparent 70%)",
        }}
      />
      <header className="border-b border-border/60 backdrop-blur-sm sticky top-0 z-20 bg-background/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center gap-3">
          <span className="grid place-items-center size-9 rounded-lg bg-primary/15 text-primary border border-primary/30">
            <LayoutDashboard className="size-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">
              Dashboard
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Weekly journal + Monthly news calendar
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <RssFeed />
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <TickerGrid />
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <SessionChart />
        <SessionRangesCard />
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <WeeklySummary />
        <WeeklyKanban />
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <MonthlyNews />
      </main>

      <footer className="border-t border-border/60 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-xs text-muted-foreground">
          Data is stored locally in your browser.
        </div>
      </footer>
    </div>
  );
}
