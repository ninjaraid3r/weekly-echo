import { useMemo, useState } from "react";
import { Plus, Clock } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  currentWeekStart,
  weekDays,
  weekKey,
  DAY_LABELS,
  fmtDay,
} from "@/lib/week";
import {
  type Entry,
  loadEntries,
  saveEntries,
  uid,
} from "@/lib/journal-storage";
import { EntryDialog } from "./EntryDialog";
import { WeeklySummary } from "./WeeklySummary";
import { isSameDay } from "date-fns";

export function WeeklyKanban() {
  const weekStart = useMemo(() => currentWeekStart(), []);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const key = weekKey(weekStart);

  const [entries, setEntries] = useState<Entry[]>(() =>
    loadEntries().filter((e) => e.weekKey === key)
  );
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);

  const persist = (next: Entry[]) => {
    const all = loadEntries().filter((e) => e.weekKey !== key);
    saveEntries([...all, ...next]);
    setEntries(next);
  };

  const addOrUpdate = (data: { title: string; notes: string }) => {
    if (editing) {
      const next = entries.map((e) =>
        e.id === editing.id ? { ...e, ...data } : e
      );
      persist(next);
    } else if (openDay !== null) {
      const entry: Entry = {
        id: uid(),
        day: openDay,
        weekKey: key,
        title: data.title,
        notes: data.notes,
        createdAt: new Date().toISOString(),
      };
      persist([...entries, entry]);
    }
    setOpenDay(null);
    setEditing(null);
  };

  const remove = () => {
    if (!editing) return;
    persist(entries.filter((e) => e.id !== editing.id));
    setOpenDay(null);
    setEditing(null);
  };

  const today = new Date();

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Week of {format(weekStart, "MMM d, yyyy")}
          </h2>
          <p className="text-sm text-muted-foreground">
            Rolls over automatically Friday at 11:00 PM.
          </p>
        </div>
        <span className="text-xs font-mono px-2 py-1 rounded bg-secondary text-secondary-foreground">
          {key}
        </span>
      </div>

      <WeeklySummary />

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((d, i) => {
          const dayEntries = entries
            .filter((e) => e.day === i)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          const isToday = isSameDay(d, today);
          return (
            <div
              key={i}
              className={`flex flex-col rounded-xl border bg-card/60 backdrop-blur-sm transition-colors ${
                isToday
                  ? "border-primary/60 shadow-[0_0_0_1px_var(--primary)]"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {DAY_LABELS[i]}
                  </div>
                  <div className="text-sm font-medium">{fmtDay(d)}</div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full hover:bg-primary/15 hover:text-primary"
                  onClick={() => {
                    setEditing(null);
                    setOpenDay(i);
                  }}
                  aria-label={`Add entry for ${DAY_LABELS[i]}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 p-2 space-y-2 min-h-32">
                {dayEntries.length === 0 && (
                  <button
                    onClick={() => {
                      setEditing(null);
                      setOpenDay(i);
                    }}
                    className="w-full text-xs text-muted-foreground/70 rounded-lg border border-dashed border-border py-6 hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    + Add entry
                  </button>
                )}
                {dayEntries.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setEditing(e);
                      setOpenDay(i);
                    }}
                    className="w-full text-left rounded-lg bg-secondary/70 hover:bg-secondary border border-border/60 hover:border-primary/40 px-3 py-2 transition-colors"
                  >
                    <div className="text-sm font-medium leading-snug">
                      {e.title}
                    </div>
                    {e.notes && (
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {e.notes}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      <Clock className="h-3 w-3" />
                      {format(new Date(e.createdAt), "MMM d · h:mm a")}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <EntryDialog
        open={openDay !== null}
        onOpenChange={(o) => {
          if (!o) {
            setOpenDay(null);
            setEditing(null);
          }
        }}
        onSave={addOrUpdate}
        onDelete={remove}
        existing={editing}
        dayLabel={
          openDay !== null
            ? `${DAY_LABELS[openDay]} ${fmtDay(days[openDay])}`
            : ""
        }
      />
    </section>
  );
}