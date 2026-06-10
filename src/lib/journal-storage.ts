export type Entry = {
  id: string;
  day: number; // 0=Mon..6=Sun
  weekKey: string; // e.g. 2026-W22
  title: string;
  notes: string;
  createdAt: string; // ISO
};

export type Impact = "high" | "medium" | "low";
export type NewsEvent = {
  id: string;
  date: string; // yyyy-MM-dd
  name: string;
  impact: Impact;
  critical?: boolean; // FOMC, PPI, CPI, NFP, etc.
};

export type DayJournal = {
  date: string; // yyyy-MM-dd
  content: string;
  updatedAt: string; // ISO
};

const ENTRIES_KEY = "journal.entries.v1";
const NEWS_KEY = "journal.news.v1";
const DAY_JOURNAL_KEY = "journal.day.v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export const loadEntries = () => read<Entry[]>(ENTRIES_KEY, []);
export const saveEntries = (e: Entry[]) => write(ENTRIES_KEY, e);
export const loadNews = () => read<NewsEvent[]>(NEWS_KEY, []);
export const saveNews = (n: NewsEvent[]) => write(NEWS_KEY, n);

export const loadDayJournals = () => read<Record<string, DayJournal>>(DAY_JOURNAL_KEY, {});
export const saveDayJournals = (j: Record<string, DayJournal>) => write(DAY_JOURNAL_KEY, j);
export const getDayJournal = (date: string): DayJournal | null =>
  loadDayJournals()[date] ?? null;
export const setDayJournal = (date: string, content: string) => {
  const all = loadDayJournals();
  if (content.trim()) {
    all[date] = { date, content, updatedAt: new Date().toISOString() };
  } else {
    delete all[date];
  }
  saveDayJournals(all);
};

export const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);