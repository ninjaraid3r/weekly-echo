import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { NotebookPen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadEntries,
  loadDayJournals,
  saveEntries,
  setDayJournal,
  type Entry,
  type DayJournal,
} from "@/lib/journal-storage";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Journal — All entries" },
      { name: "description", content: "Chronological table of all journal entries." },
    ],
  }),
  component: JournalPage,
});

type Row = {
  key: string;
  date: string; // yyyy-MM-dd
  when: Date;
  type: "Day" | "Entry";
  title: string;
  content: string;
  ref: { kind: "day"; date: string } | { kind: "entry"; id: string };
};

function buildRows(entries: Entry[], days: Record<string, DayJournal>): Row[] {
  const rows: Row[] = [];
  for (const d of Object.values(days)) {
    rows.push({
      key: `day-${d.date}`,
      date: d.date,
      when: new Date(d.updatedAt),
      type: "Day",
      title: format(new Date(d.date + "T12:00:00"), "EEEE"),
      content: d.content,
      ref: { kind: "day", date: d.date },
    });
  }
  for (const e of entries) {
    const when = new Date(e.createdAt);
    rows.push({
      key: `entry-${e.id}`,
      date: when.toISOString().slice(0, 10),
      when,
      type: "Entry",
      title: e.title,
      content: e.notes,
      ref: { kind: "entry", id: e.id },
    });
  }
  rows.sort((a, b) => b.when.getTime() - a.when.getTime());
  return rows;
}

function JournalPage() {
  const [tick, setTick] = useState(0);
  const rows = useMemo(() => {
    void tick;
    return buildRows(loadEntries(), loadDayJournals());
  }, [tick]);

  const remove = (row: Row) => {
    if (!confirm("Delete this entry?")) return;
    if (row.ref.kind === "day") {
      setDayJournal(row.ref.date, "");
    } else {
      const id = row.ref.id;
      saveEntries(loadEntries().filter((e) => e.id !== id));
    }
    setTick((t) => t + 1);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 backdrop-blur-sm sticky top-0 z-20 bg-background/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center gap-3">
          <span className="grid place-items-center size-9 rounded-lg bg-primary/15 text-primary border border-primary/30">
            <NotebookPen className="size-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">Journal</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              All entries · sorted by date (newest first)
            </p>
          </div>
          <span className="ml-auto text-xs font-mono px-2 py-1 rounded bg-secondary text-secondary-foreground">
            {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/60 p-12 text-center text-sm text-muted-foreground">
            No entries yet. Add one from the Weekly or Monthly view.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card/70 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/70 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold w-32">Date</th>
                  <th className="text-left px-4 py-3 font-semibold w-24">Time</th>
                  <th className="text-left px-4 py-3 font-semibold w-20">Type</th>
                  <th className="text-left px-4 py-3 font-semibold w-48">Title</th>
                  <th className="text-left px-4 py-3 font-semibold">Content</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className="border-t border-border/60 align-top hover:bg-accent/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted-foreground">
                      {format(r.when, "h:mm a")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                          (r.type === "Day"
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-secondary text-secondary-foreground border border-border")
                        }
                      >
                        {r.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{r.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="whitespace-pre-wrap line-clamp-4 max-w-2xl">
                        {r.content || <span className="italic">(empty)</span>}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => remove(r)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}