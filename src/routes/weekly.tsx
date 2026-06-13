import { createFileRoute } from "@tanstack/react-router";
import { WeeklyKanban } from "@/components/journal/WeeklyKanban";
import { WeeklySummary } from "@/components/journal/WeeklySummary";
import { BookOpenText } from "lucide-react";

export const Route = createFileRoute("/weekly")({
  head: () => ({
    meta: [
      { title: "Weekly Journal — Kanban View" },
      {
        name: "description",
        content: "Journal your week in a focused kanban view.",
      },
    ],
  }),
  component: WeeklyPage,
});

function WeeklyPage() {
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
            <BookOpenText className="size-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">
              Weekly Journal
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Kanban view · Track your week
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
        <WeeklySummary />
        <WeeklyKanban />
      </main>

      <footer className="border-t border-border/60 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-xs text-muted-foreground">
          Data is stored locally in your browser.
        </div>
      </footer>
    </div>
  );
}
