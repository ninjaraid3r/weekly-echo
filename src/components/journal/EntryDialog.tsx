import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Entry } from "@/lib/journal-storage";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (data: { title: string; notes: string }) => void;
  dayLabel: string;
  existing?: Entry | null;
  onDelete?: () => void;
}

export function EntryDialog({
  open,
  onOpenChange,
  onSave,
  dayLabel,
  existing,
  onDelete,
}: Props) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(existing?.title ?? "");
      setNotes(existing?.notes ?? "");
    }
  }, [open, existing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit entry" : "New entry"} — {dayLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What happened?"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Details..."
              rows={5}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {existing && onDelete && (
              <Button variant="ghost" onClick={onDelete} className="text-destructive">
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!title.trim()) return;
                onSave({ title: title.trim(), notes: notes.trim() });
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