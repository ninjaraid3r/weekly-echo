export type UserPrefs = {
  displayName: string;
  defaultTemplate: "none" | "recap" | "learned" | "improve" | "market" | "gratitude";
  quotesRefreshSec: number;
  showTickers: boolean;
  showRss: boolean;
  showSessionLights: boolean;
  showPowerHourTicker: boolean;
  weekStartsMonday: boolean;
  clock24h: boolean;
  compactMode: boolean;
};

const KEY = "journal.user.prefs.v1";

export const DEFAULT_PREFS: UserPrefs = {
  displayName: "",
  defaultTemplate: "none",
  quotesRefreshSec: 30,
  showTickers: true,
  showRss: true,
  showSessionLights: true,
  showPowerHourTicker: true,
  weekStartsMonday: true,
  clock24h: false,
  compactMode: false,
};

export function loadPrefs(): UserPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<UserPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: UserPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new CustomEvent("user-prefs-changed"));
}

export function exportAllData(): string {
  const dump: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (!k.startsWith("journal.") && k !== "fred_api_key") continue;
    try {
      dump[k] = JSON.parse(localStorage.getItem(k) ?? "null");
    } catch {
      dump[k] = localStorage.getItem(k);
    }
  }
  return JSON.stringify({ exportedAt: new Date().toISOString(), data: dump }, null, 2);
}

export function importAllData(json: string): number {
  const parsed = JSON.parse(json) as { data?: Record<string, unknown> };
  const data = parsed.data ?? {};
  let count = 0;
  for (const [k, v] of Object.entries(data)) {
    localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    count++;
  }
  return count;
}