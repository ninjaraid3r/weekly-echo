import { createFileRoute } from "@tanstack/react-router";
import { MonthlyNews } from "@/components/journal/MonthlyNews";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/monthly")({
  head: () => ({
    meta: [
      { title: "Monthly Calendar — U.S. News Releases" },
      {
        name: "description",
        content: "Track high, medium, and low impact U.S. economic news releases by month.",
      },
    ],
  }),
  component: MonthlyPage,
});

function MonthlyPage() {
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
            <CalendarDays className="size-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">
              Monthly Calendar
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              U.S. economic news releases · Impact tracking
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
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
