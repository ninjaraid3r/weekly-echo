import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import type { NewsEvent } from "@/lib/journal-storage";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: string;
  initialContent: string;
  events: NewsEvent[];
  onSave: (content: string) => void;
}

const TEMPLATES: Array<{ label: string; body: string }> = [
  {
    label: "Daily Recap",
    body:
      "## How the day went\n- \n\n## Wins\n- \n\n## Challenges\n- \n",
  },
  {
    label: "What I Learned",
    body:
      "## Something I learned today\n- \n\n## Why it matters\n- \n\n## How I'll apply it\n- \n",
  },
  {
    label: "Improvements",
    body:
      "## What I can improve on\n- \n\n## Action steps\n1. \n2. \n3. \n",
  },
  {
    label: "Market Day",
    body:
      "## Market read\n- \n\n## Trades / setups\n- \n\n## News impact on my plan\n- \n\n## Lesson for tomorrow\n- \n",
  },
  {
    label: "Gratitude",
    body: "## Three things I'm grateful for\n1. \n2. \n3. \n",
  },
];

export function DayJournalDialog({
  open,
  onOpenChange,
  date,
  initialContent,
  events,
  onSave,
}: Props) {
  const [content, setContent] = useState("");

  useEffect(() => {
    if (open) setContent(initialContent);
  }, [open, initialContent]);

  const insertTemplate = (body: string) => {
    setContent((prev) => {
      if (!prev.trim()) return body;
      return prev.replace(/\s*$/, "") + "\n\n" + body;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Journal — {date}
          </DialogTitle>
        </DialogHeader>

        {events.length > 0 && (
          <div className="rounded-md border border-border p-2 max-h-32 overflow-auto space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Releases this day
            </div>
            {events.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 text-xs px-1"
              >
                <span
                  className="inline-block size-2 rounded-full shrink-0"
                  style={{
                    background:
                      e.impact === "high"
                        ? "var(--impact-high)"
                        : e.impact === "medium"
                          ? "var(--impact-medium)"
                          : "var(--impact-low)",
                  }}
                />
                <span className="truncate">{e.name}</span>
                {e.critical && (
                  <span className="ml-auto text-[9px] rounded px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/30">
                    Key
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
              <Sparkles className="size-3" /> Templates
            </span>
            {TEMPLATES.map((t) => (
              <Button
                key={t.label}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => insertTemplate(t.body)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write about your day — how it went, what you learned, what you can improve…"
            rows={14}
            className="font-mono text-sm leading-relaxed"
            autoFocus
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              setContent("");
              onSave("");
              onOpenChange(false);
            }}
          >
            Clear
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSave(content);
                onOpenChange(false);
              }}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}