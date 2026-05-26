import {
  startOfWeek,
  addDays,
  format,
  getISOWeek,
  getISOWeekYear,
  isAfter,
  setHours,
  setMinutes,
  setSeconds,
} from "date-fns";

// Week rolls over Friday at 23:00. After that we show next week.
export function currentWeekStart(now: Date = new Date()): Date {
  // Monday-based week
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const friday = addDays(monday, 4);
  const rollover = setSeconds(setMinutes(setHours(friday, 23), 0), 0);
  if (isAfter(now, rollover)) {
    return addDays(monday, 7);
  }
  return monday;
}

export function weekKey(weekStart: Date): string {
  return `${getISOWeekYear(weekStart)}-W${String(getISOWeek(weekStart)).padStart(2, "0")}`;
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function fmtDay(d: Date) {
  return format(d, "MMM d");
}

export function fmtDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}