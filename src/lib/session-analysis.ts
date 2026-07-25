import type { Bar } from "@/lib/intraday.functions";

export type SessionKey = "asia" | "london" | "nyam" | "lunch" | "nypm";

export type SessionDef = {
  key: SessionKey;
  label: string;
  /** minutes from ET midnight of the trading day this session anchors to */
  startMin: number;
  endMin: number;
  /** if true, session starts on the PREVIOUS ET calendar day at (startMin) */
  prevDay?: boolean;
  color: string; // hex line color
};

export const SESSIONS: SessionDef[] = [
  { key: "asia", label: "Asia", startMin: 18 * 60, endMin: 24 * 60 + 1 * 60 + 30, prevDay: true, color: "#ef4444" },
  { key: "london", label: "London", startMin: 1 * 60 + 30, endMin: 8 * 60, color: "#3b82f6" },
  { key: "nyam", label: "NY AM", startMin: 9 * 60 + 30, endMin: 11 * 60 + 30, color: "#22c55e" },
  { key: "lunch", label: "Lunch", startMin: 11 * 60 + 30, endMin: 13 * 60 + 30, color: "#f97316" },
  { key: "nypm", label: "NY PM", startMin: 13 * 60 + 30, endMin: 16 * 60, color: "#a855f7" },
];

/** ET-adjusted date parts for a given epoch ms. */
function etParts(ms: number) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(ms)).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10) % 24,
    minute: parseInt(parts.minute, 10),
  };
}

/** Today's trading-day date string in ET (yyyy-mm-dd). */
export function etTradingDay(now = Date.now()): string {
  const p = etParts(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Ms epoch for a given ET date + minute-of-day, adjusting for DST. */
export function etDateTimeToMs(dateYmd: string, minuteOfDay: number): number {
  // Binary-search approach avoided; use direct offset lookup via Intl.
  const [y, m, d] = dateYmd.split("-").map(Number);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  // Try UTC guess then adjust by ET offset for that instant.
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const p = etParts(guess);
  const guessedMin = p.hour * 60 + p.minute;
  // Compute delta (in minutes) between guessed ET and desired ET
  const desiredMin = hour * 60 + minute;
  // Handle date rollover (if guessed date differs)
  const guessDate = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  let dayDelta = 0;
  if (guessDate < dateYmd) dayDelta = 1;
  else if (guessDate > dateYmd) dayDelta = -1;
  const deltaMin = desiredMin - guessedMin + dayDelta * 24 * 60;
  return guess + deltaMin * 60_000;
}

export type SessionRange = {
  key: SessionKey;
  label: string;
  color: string;
  startMs: number;
  endMs: number;
  high: number | null;
  low: number | null;
  /** Opening range = first 30 minutes */
  orHigh: number | null;
  orLow: number | null;
  hasData: boolean;
};

export function computeSessionRanges(bars: Bar[], tradingDay: string): SessionRange[] {
  return SESSIONS.map((s) => {
    let anchorDay = tradingDay;
    if (s.prevDay) {
      const [y, m, d] = tradingDay.split("-").map(Number);
      const prev = new Date(Date.UTC(y, m - 1, d));
      prev.setUTCDate(prev.getUTCDate() - 1);
      anchorDay = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
    }
    const startMs = etDateTimeToMs(anchorDay, s.startMin);
    const endMs = etDateTimeToMs(anchorDay, s.endMin);
    const orEndMs = startMs + 30 * 60_000;
    let high = -Infinity, low = Infinity, orHigh = -Infinity, orLow = Infinity;
    let count = 0, orCount = 0;
    for (const b of bars) {
      if (b.t < startMs || b.t >= endMs) continue;
      count++;
      if (b.h > high) high = b.h;
      if (b.l < low) low = b.l;
      if (b.t < orEndMs) {
        orCount++;
        if (b.h > orHigh) orHigh = b.h;
        if (b.l < orLow) orLow = b.l;
      }
    }
    return {
      key: s.key,
      label: s.label,
      color: s.color,
      startMs,
      endMs,
      high: count ? high : null,
      low: count ? low : null,
      orHigh: orCount ? orHigh : null,
      orLow: orCount ? orLow : null,
      hasData: count > 0,
    };
  });
}

/** ATR14 from daily bars (last close = today or most recent). */
export function computeAtr(daily: Bar[], period = 14): number | null {
  if (daily.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < daily.length; i++) {
    const p = daily[i - 1];
    const c = daily[i];
    const tr = Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c));
    trs.push(tr);
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// ---------- Expected-move manual override storage ----------
const emKey = (symbol: string, day: string) => `expectedMove:${symbol}:${day}`;

export function getManualExpectedMove(symbol: string, day: string): number | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(emKey(symbol, day));
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function setManualExpectedMove(symbol: string, day: string, value: number | null) {
  if (typeof window === "undefined") return;
  if (value == null || !Number.isFinite(value)) window.localStorage.removeItem(emKey(symbol, day));
  else window.localStorage.setItem(emKey(symbol, day), String(value));
}

/** Prior day's close from daily bars (last completed session). */
export function priorClose(daily: Bar[]): number | null {
  if (daily.length < 2) return null;
  return daily[daily.length - 2].c;
}