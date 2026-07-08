export type RssFeed = {
  id: string;
  url: string;
  name?: string;
};

const KEY = "journal.rss.feeds.v1";

export function loadFeeds(): RssFeed[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RssFeed[]) : [];
  } catch {
    return [];
  }
}

export function saveFeeds(feeds: RssFeed[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(feeds));
  window.dispatchEvent(new CustomEvent("rss-feeds-changed"));
}

export function addFeed(url: string, name?: string): RssFeed[] {
  const feeds = loadFeeds();
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const next = [...feeds, { id, url, name }];
  saveFeeds(next);
  return next;
}

export function removeFeed(id: string): RssFeed[] {
  const next = loadFeeds().filter((f) => f.id !== id);
  saveFeeds(next);
  return next;
}