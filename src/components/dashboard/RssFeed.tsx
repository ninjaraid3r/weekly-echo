import { useEffect, useState, useCallback } from "react";
import { Rss, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadFeeds, type RssFeed } from "@/lib/rss-storage";
import { fetchRssFeeds, type RssItem } from "@/lib/rss.functions";
import { formatDistanceToNow } from "date-fns";

export function RssFeed() {
  const [feeds, setFeeds] = useState<RssFeed[]>(() => loadFeeds());
  const [items, setItems] = useState<RssItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (urls: string[]) => {
    if (urls.length === 0) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRssFeeds({ data: { urls } });
      setItems(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feeds");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(feeds.map((f) => f.url));
  }, [feeds, refresh]);

  useEffect(() => {
    const onChange = () => setFeeds(loadFeeds());
    window.addEventListener("rss-feeds-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("rss-feeds-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center size-9 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/30">
            <Rss className="size-4" />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">News Feed</h2>
            <p className="text-sm text-muted-foreground">
              {feeds.length} source{feeds.length === 1 ? "" : "s"} · manage in Settings
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh(feeds.map((f) => f.url))}
          disabled={loading || feeds.length === 0}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Refresh
        </Button>
      </div>

      {feeds.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No RSS feeds yet. Add some in <span className="text-primary">Settings</span>.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden">
          {items.map((it, i) => (
            <li key={`${it.link}-${i}`}>
              <a
                href={it.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-4 hover:bg-accent/40 transition-colors"
              >
                <span className="mt-1 inline-block size-1.5 rounded-full bg-orange-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <span className="truncate">{it.source}</span>
                    {it.pubDate && (
                      <span>· {formatDistanceToNow(new Date(it.pubDate), { addSuffix: true })}</span>
                    )}
                  </div>
                  <div className="text-sm font-medium leading-snug mt-0.5 line-clamp-2">
                    {it.title}
                  </div>
                  {it.description && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {it.description}
                    </div>
                  )}
                </div>
                <ExternalLink className="size-3.5 text-muted-foreground shrink-0 mt-1" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}