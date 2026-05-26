import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Impact, NewsEvent } from "@/lib/journal-storage";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: string;
  events: NewsEvent[];
  onAdd: (e: { name: string; impact: Impact; critical: boolean }) => void;
  onRemove: (id: string) => void;
}

export function NewsDialog({
  open,
  onOpenChange,
  date,
  events,
  onAdd,
  onRemove,
}: Props) {
  const [name, setName] = useState("");
  const [impact, setImpact] = useState<Impact>("high");
  const [critical, setCritical] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setImpact("high");
      setCritical(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>News releases — {date}</DialogTitle>
        </DialogHeader>

        {events.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-auto rounded-md border border-border p-2">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{
                      background:
                        e.impact === "high"
                          ? "var(--impact-high)"
                          : e.impact === "medium"
                            ? "var(--impact-medium)"
                            : "var(--impact-low)",
                    }}
                  />
                  <span>{e.name}</span>
                  {e.critical && (
                    <span className="text-xs rounded px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/30">
                      Key
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(e.id)}
                  className="h-7 text-destructive"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <Label htmlFor="evt">Event name</Label>
            <Input
              id="evt"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="FOMC, CPI, NFP, PPI..."
            />
          </div>
          <div className="space-y-1">
            <Label>Impact</Label>
            <Select value={impact} onValueChange={(v) => setImpact(v as Impact)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High (red)</SelectItem>
                <SelectItem value="medium">Medium (orange)</SelectItem>
                <SelectItem value="low">Low (yellow)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={critical}
              onCheckedChange={(c) => setCritical(Boolean(c))}
            />
            Mark as key release (blue highlight)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              onAdd({ name: name.trim(), impact, critical });
            }}
          >
            Add release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}