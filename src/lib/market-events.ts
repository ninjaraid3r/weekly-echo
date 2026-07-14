import { getDay, getDate } from "date-fns";

export type MarketEvent = {
  label: string;
  /** tailwind text color class */
  className?: string;
};

/**
 * Returns any recurring market events for the given date.
 * - Every Wednesday: "VIX EXP - 9:30am OPEN"
 * - Monthly options expiration (3rd Friday): "Options Expiration"
 */
export function getMarketEvents(date: Date): MarketEvent[] {
  const out: MarketEvent[] = [];
  const dow = getDay(date); // 0 Sun ... 6 Sat
  const dom = getDate(date);

  if (dow === 3) {
    out.push({
      label: "VIX EXP - 9:30am OPEN",
      className: "bg-foreground text-background px-1.5 py-0.5 rounded inline-block",
    });
  }
  // Third Friday: Friday (5) AND day-of-month between 15 and 21
  if (dow === 5 && dom >= 15 && dom <= 21) {
    out.push({
      label: "Options Expiration",
      className: "bg-foreground text-background px-1.5 py-0.5 rounded inline-block",
    });
  }
  return out;
}