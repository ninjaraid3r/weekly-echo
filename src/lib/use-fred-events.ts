import { useEffect, useState } from "react";
import type { NewsEvent } from "./journal-storage";
import { fetchFredEvents } from "./fred.functions";

const FRED_API_KEY_STORAGE = "fred_api_key";

export function getStoredFredKey(): string | null {
  return localStorage.getItem(FRED_API_KEY_STORAGE);
}

export function setStoredFredKey(key: string) {
  localStorage.setItem(FRED_API_KEY_STORAGE, key);
}

const cache = new Map<string, NewsEvent[]>();
const inflight = new Map<string, Promise<NewsEvent[]>>();

export function clearFredCache() {
  cache.clear();
  inflight.clear();
}

export function useFredEvents(start: string, end: string) {
  const key = `${start}|${end}`;
  const [events, setEvents] = useState<NewsEvent[]>(() => cache.get(key) ?? []);
  const [loading, setLoading] = useState(!cache.has(key));
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (cache.has(key)) {
      setEvents(cache.get(key)!);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const apiKey = getStoredFredKey() ?? undefined;
    const p =
      inflight.get(key) ??
      fetchFredEvents({ data: { start, end, apiKey } }).then((r) => {
        cache.set(key, r);
        inflight.delete(key);
        return r;
      });
    inflight.set(key, p);
    p.then((r) => {
      if (cancelled) return;
      setEvents(r);
      setLoading(false);
    }).catch((e) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [key, start, end, nonce]);

  const refetch = () => {
    clearFredCache();
    setNonce((n) => n + 1);
  };

  return { events, loading, error, refetch };
}
