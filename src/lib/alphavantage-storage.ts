import { persistGet, persistRemove, persistSet } from "@/lib/persist";

const AV_KEY = "alphavantage_api_key";

export function getStoredAvKey(): string | null {
  return persistGet(AV_KEY);
}

export function setStoredAvKey(key: string) {
  persistSet(AV_KEY, key);
}

export function clearStoredAvKey() {
  persistRemove(AV_KEY);
}

export const OPTIONS_SYMBOLS = ["SPY", "QQQ", "IWM", "NVDA", "TSLA", "AAPL"] as const;
