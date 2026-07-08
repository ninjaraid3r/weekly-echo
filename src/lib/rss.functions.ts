import { createServerFn } from "@tanstack/react-start";

export type RssItem = {
  title: string;
  link: string;
  pubDate: string | null;
  source: string;
  description: string | null;
};

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).trim();
}

function pick(tag: string, block: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]).trim() : null;
}

function pickLink(block: string): string | null {
  // atom style: <link href="..."/>
  const atom = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (atom) return atom[1];
  const rss = pick("link", block);
  return rss;
}

function parseFeed(xml: string, sourceUrl: string): { title: string; items: RssItem[] } {
  const channelTitle =
    pick("title", xml.split(/<item[\s>]/i)[0] ?? "") ??
    pick("title", xml.split(/<entry[\s>]/i)[0] ?? "") ??
    sourceUrl;

  const items: RssItem[] = [];
  // RSS <item>
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[0];
    const title = stripTags(pick("title", block) ?? "");
    const link = (pickLink(block) ?? "").trim();
    const pubDate = pick("pubDate", block) ?? pick("dc:date", block);
    const desc = pick("description", block) ?? pick("content:encoded", block);
    if (title || link) {
      items.push({
        title: title || "(untitled)",
        link,
        pubDate,
        source: channelTitle,
        description: desc ? stripTags(desc).slice(0, 240) : null,
      });
    }
  }
  // Atom <entry>
  const entryRe = /<entry[\s>][\s\S]*?<\/entry>/gi;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[0];
    const title = stripTags(pick("title", block) ?? "");
    const link = (pickLink(block) ?? "").trim();
    const pubDate = pick("updated", block) ?? pick("published", block);
    const desc = pick("summary", block) ?? pick("content", block);
    if (title || link) {
      items.push({
        title: title || "(untitled)",
        link,
        pubDate,
        source: channelTitle,
        description: desc ? stripTags(desc).slice(0, 240) : null,
      });
    }
  }
  return { title: channelTitle, items };
}

export const fetchRssFeeds = createServerFn({ method: "GET" })
  .inputValidator((d: { urls: string[] }) => {
    if (!Array.isArray(d.urls)) throw new Error("urls must be an array");
    for (const u of d.urls) {
      try {
        new URL(u);
      } catch {
        throw new Error(`Invalid URL: ${u}`);
      }
    }
    return d;
  })
  .handler(async ({ data }): Promise<RssItem[]> => {
    const results = await Promise.allSettled(
      data.urls.map(async (url) => {
        const res = await fetch(url, {
          headers: { "User-Agent": "LovableJournal/1.0", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
        });
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        const xml = await res.text();
        return parseFeed(xml, url).items;
      })
    );
    const merged: RssItem[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") merged.push(...r.value);
    }
    merged.sort((a, b) => {
      const at = a.pubDate ? Date.parse(a.pubDate) : 0;
      const bt = b.pubDate ? Date.parse(b.pubDate) : 0;
      return bt - at;
    });
    return merged.slice(0, 60);
  });