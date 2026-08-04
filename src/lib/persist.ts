/**
 * Durable key/value storage for small settings like API keys.
 * Writes to localStorage AND a 1-year cookie, so a key survives even when
 * one of the two is cleared (e.g. embedded/preview browsers wiping storage).
 */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${encodeURIComponent(name)}=`));
  if (!match) return null;
  const raw = match.slice(match.indexOf("=") + 1);
  try {
    return decodeURIComponent(raw) || null;
  } catch {
    return raw || null;
  }
}

export function persistGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  let v: string | null = null;
  try {
    v = window.localStorage.getItem(key);
  } catch {
    /* storage blocked */
  }
  if (v) return v;
  const cookie = readCookie(key);
  if (cookie) {
    try {
      window.localStorage.setItem(key, cookie); // re-hydrate localStorage
    } catch {
      /* ignore */
    }
    return cookie;
  }
  return null;
}

export function persistSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }
}

export function persistRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; SameSite=Lax`;
  }
}
