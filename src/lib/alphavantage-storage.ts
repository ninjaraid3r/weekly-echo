const AV_KEY = "alphavantage_api_key";

export function getStoredAvKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AV_KEY);
}

export function setStoredAvKey(key: string) {
  localStorage.setItem(AV_KEY, key);
}

export function clearStoredAvKey() {
  localStorage.removeItem(AV_KEY);
}

export const OPTIONS_SYMBOLS = ["SPY", "QQQ", "IWM", "NVDA", "TSLA", "AAPL"] as const;
