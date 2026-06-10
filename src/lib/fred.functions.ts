import { createServerFn } from "@tanstack/react-start";
import type { Impact, NewsEvent } from "./journal-storage";

// Map FRED release names → impact/critical
// Order matters: first match wins.
const RULES: Array<{ test: RegExp; impact: Impact; critical?: boolean }> = [
  { test: /fomc|federal open market|fed funds|interest rate decision|press conference/i, impact: "high", critical: true },
  { test: /consumer price index|^cpi\b/i, impact: "high", critical: true },
  { test: /producer price index|^ppi\b/i, impact: "high", critical: true },
  { test: /employment situation|nonfarm|payroll|\bnfp\b/i, impact: "high", critical: true },
  { test: /gross domestic product|^gdp\b/i, impact: "high", critical: true },
  { test: /personal income.*outlays|\bpce\b|personal consumption expenditures/i, impact: "high", critical: true },
  { test: /retail sales/i, impact: "high" },
  { test: /jobless claims|unemployment insurance|adp/i, impact: "medium" },
  { test: /ism|purchasing managers|^pmi\b/i, impact: "medium" },
  { test: /consumer confidence|consumer sentiment|michigan/i, impact: "medium" },
  { test: /durable goods|factory orders|industrial production|capacity utilization/i, impact: "medium" },
  { test: /housing starts|building permits|new home sales|existing home sales|case-shiller|home price/i, impact: "medium" },
  { test: /trade balance|international trade|import|export price/i, impact: "medium" },
  { test: /beige book/i, impact: "medium", critical: true },
  { test: /treasury|auction|budget|tic/i, impact: "low" },
];

function classify(name: string): { impact: Impact; critical: boolean } | null {
  for (const r of RULES) {
    if (r.test.test(name)) return { impact: r.impact, critical: !!r.critical };
  }
  return null;
}

type FredResp = {
  release_dates?: Array<{ release_id: number; release_name: string; date: string }>;
};

export const fetchFredEvents = createServerFn({ method: "GET" })
  .inputValidator((d: { start: string; end: string; apiKey?: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.start) || !/^\d{4}-\d{2}-\d{2}$/.test(d.end)) {
      throw new Error("Invalid date range");
    }
    return d;
  })
  .handler(async ({ data }): Promise<NewsEvent[]> => {
    const key = data.apiKey || process.env.FRED_API_KEY;
    if (!key) throw new Error("FRED_API_KEY is not configured");

    const url = new URL("https://api.stlouisfed.org/fred/releases/dates");
    url.searchParams.set("api_key", key);
    url.searchParams.set("file_type", "json");
    url.searchParams.set("realtime_start", data.start);
    url.searchParams.set("realtime_end", data.end);
    url.searchParams.set("include_release_dates_with_no_data", "true");
    url.searchParams.set("limit", "1000");
    url.searchParams.set("order_by", "release_date");
    url.searchParams.set("sort_order", "asc");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`FRED API ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as FredResp;
    const out: NewsEvent[] = [];
    const seen = new Set<string>();
    for (const r of json.release_dates ?? []) {
      const cls = classify(r.release_name);
      if (!cls) continue;
      // Dedupe identical (date+name) entries
      const k = `${r.date}|${r.release_name}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        id: `fred-${r.release_id}-${r.date}`,
        date: r.date,
        name: r.release_name,
        impact: cls.impact,
        critical: cls.critical,
      });
    }
    return out;
  });

export const testFredConnection = createServerFn({ method: "GET" })
  .inputValidator((d: { apiKey: string }) => {
    if (!d.apiKey || d.apiKey.length < 10) throw new Error("Invalid API key");
    return d;
  })
  .handler(async ({ data }) => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const startStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

    const url = new URL("https://api.stlouisfed.org/fred/releases/dates");
    url.searchParams.set("api_key", data.apiKey);
    url.searchParams.set("file_type", "json");
    url.searchParams.set("realtime_start", startStr);
    url.searchParams.set("realtime_end", endStr);
    url.searchParams.set("limit", "10");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`FRED API ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as FredResp;
    const count = json.release_dates?.length ?? 0;
    return { success: true, count, message: `Connection successful. Found ${count} releases this month.` };
  });
