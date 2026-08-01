import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { testFredConnection } from "@/lib/fred.functions";
import { getStoredFredKey, setStoredFredKey } from "@/lib/use-fred-events";
import { testAlphaVantage } from "@/lib/options.functions";
import { getStoredAvKey, setStoredAvKey } from "@/lib/alphavantage-storage";
import { loadFeeds, addFeed, removeFeed, type RssFeed } from "@/lib/rss-storage";
import {
  loadPrefs,
  savePrefs,
  exportAllData,
  importAllData,
  DEFAULT_PREFS,
  type UserPrefs,
} from "@/lib/user-prefs";
import {
  KeyRound,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Info,
  Settings,
  Rss,
  Plus,
  Trash2,
  User,
  Sliders,
  Download,
  Upload,
  RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Weekly Journal" },
      {
        name: "description",
        content: "Configure your FRED API key and app settings.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [newFeedName, setNewFeedName] = useState("");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [avKey, setAvKey] = useState("");
  const [avSaved, setAvSaved] = useState(false);
  const [avTesting, setAvTesting] = useState(false);
  const [avResult, setAvResult] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const testFn = useServerFn(testFredConnection);
  const avTestFn = useServerFn(testAlphaVantage);

  useEffect(() => {
    const stored = getStoredFredKey();
    if (stored) {
      setApiKey(stored);
      setSaved(true);
    }
    setFeeds(loadFeeds());
    setPrefs(loadPrefs());
    const av = getStoredAvKey();
    if (av) {
      setAvKey(av);
      setAvSaved(true);
    }
  }, []);

  const handleAvSave = () => {
    setStoredAvKey(avKey.trim());
    setAvSaved(true);
    setAvResult(null);
  };

  const handleAvTest = async () => {
    if (!avKey.trim()) return;
    setAvTesting(true);
    setAvResult(null);
    try {
      const r = await avTestFn({ data: { apiKey: avKey.trim() } });
      setAvResult({ type: r.ok ? "success" : "error", message: r.message });
    } catch (e) {
      setAvResult({
        type: "error",
        message: e instanceof Error ? e.message : "Connection failed.",
      });
    } finally {
      setAvTesting(false);
    }
  };

  const updatePref = <K extends keyof UserPrefs>(k: K, v: UserPrefs[K]) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    savePrefs(next);
  };

  const handleExport = () => {
    const blob = new Blob([exportAllData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `journal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const n = importAllData(String(reader.result ?? ""));
        setImportMsg(`Imported ${n} keys. Reload to see changes.`);
      } catch (e) {
        setImportMsg(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    reader.readAsText(file);
  };

  const handleAddFeed = () => {
    const url = newFeedUrl.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      setFeedError("Enter a valid URL (including https://)");
      return;
    }
    setFeedError(null);
    setFeeds(addFeed(url, newFeedName.trim() || undefined));
    setNewFeedUrl("");
    setNewFeedName("");
  };

  const handleRemoveFeed = (id: string) => {
    setFeeds(removeFeed(id));
  };

  const handleSave = () => {
    setStoredFredKey(apiKey.trim());
    setSaved(true);
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testFn({ data: { apiKey: apiKey.trim() } });
      setTestResult({ type: "success", message: result.message });
    } catch (e) {
      setTestResult({
        type: "error",
        message: e instanceof Error ? e.message : "Connection failed",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        className="absolute inset-x-0 top-0 h-64 -z-10 opacity-60 pointer-events-none"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, color-mix(in oklch, var(--primary) 25%, transparent), transparent 70%)",
        }}
      />
      <header className="border-b border-border/60 backdrop-blur-sm sticky top-0 z-20 bg-background/70">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center gap-3">
          <span className="grid place-items-center size-9 rounded-lg bg-primary/15 text-primary border border-primary/30">
            <Settings className="size-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">Settings</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Configure API keys and preferences
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-8">
        {/* Profile Card */}
        <section className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center size-10 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
              <User className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-card-foreground">Profile</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Personalize how the app greets you.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Display Name
            </label>
            <input
              type="text"
              value={prefs.displayName}
              onChange={(e) => updatePref("displayName", e.target.value)}
              placeholder="Trader"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </section>

        {/* Preferences Card */}
        <section className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center size-10 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Sliders className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-card-foreground">
                Preferences
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Everyday behavior — display, clock, and dashboard modules.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">
                Default Journal Template
              </label>
              <select
                value={prefs.defaultTemplate}
                onChange={(e) =>
                  updatePref("defaultTemplate", e.target.value as UserPrefs["defaultTemplate"])
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="none">None (blank)</option>
                <option value="recap">Daily Recap</option>
                <option value="learned">What I Learned</option>
                <option value="improve">Improvements</option>
                <option value="market">Market Day</option>
                <option value="gratitude">Gratitude</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">
                Quotes Refresh (seconds)
              </label>
              <input
                type="number"
                min={10}
                max={600}
                value={prefs.quotesRefreshSec}
                onChange={(e) =>
                  updatePref("quotesRefreshSec", Math.max(10, Number(e.target.value) || 30))
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["showTickers", "Show Live Ticker cards on Dashboard"],
                ["showRss", "Show RSS Feed on Dashboard"],
                ["showSessionLights", "Show Session Lights in top bar"],
                ["showPowerHourTicker", "Show Power Hour ticker tape (3–4pm ET)"],
                ["weekStartsMonday", "Week starts on Monday"],
                ["clock24h", "Use 24-hour clock"],
                ["compactMode", "Compact mode (tighter spacing)"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-lg border border-input bg-background/50 px-3 py-2 text-sm cursor-pointer hover:bg-accent/40"
              >
                <input
                  type="checkbox"
                  checked={prefs[key] as boolean}
                  onChange={(e) => updatePref(key, e.target.checked as never)}
                  className="size-4 accent-primary"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={() => {
              savePrefs(DEFAULT_PREFS);
              setPrefs(DEFAULT_PREFS);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
          >
            <RotateCcw className="size-3.5" /> Reset preferences to defaults
          </button>
        </section>

        {/* FRED API Key Card */}
        <section className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center size-10 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
              <KeyRound className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-card-foreground">
                FRED API Key
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your Federal Reserve Economic Data API key to sync U.S. economic
                news releases automatically.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setSaved(false);
                setTestResult(null);
              }}
              placeholder="Paste your FRED API key here..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-shadow"
            />
            {saved && (
              <p className="text-xs text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="size-3.5" />
                Key saved locally in your browser.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              disabled={!apiKey.trim()}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Key
            </button>
            <button
              onClick={handleTest}
              disabled={!apiKey.trim() || testing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Testing…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Test Connection
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
                testResult.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : "border-red-500/30 bg-red-500/10 text-red-500"
              }`}
            >
              {testResult.type === "success" ? (
                <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="size-4 mt-0.5 shrink-0" />
              )}
              {testResult.message}
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Info className="size-3.5" />
              Don&apos;t have a FRED API key?
            </div>
            <p>
              The Federal Reserve Bank of St. Louis provides free API access to
              economic data. You can request a key in seconds.
            </p>
            <a
              href="https://fred.stlouisfed.org/docs/api/api_key.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
            >
              Get your free FRED API key
              <ExternalLink className="size-3" />
            </a>
          </div>
        </section>

        {/* RSS Feeds Card */}
        <section className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center size-10 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
              <Rss className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-card-foreground">
                RSS News Feeds
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Add RSS/Atom feed URLs. New items load automatically into the
                Dashboard&apos;s News Feed panel.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              type="url"
              value={newFeedUrl}
              onChange={(e) => setNewFeedUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddFeed();
              }}
            />
            <input
              type="text"
              value={newFeedName}
              onChange={(e) => setNewFeedName(e.target.value)}
              placeholder="Name (optional)"
              className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddFeed();
              }}
            />
            <button
              onClick={handleAddFeed}
              disabled={!newFeedUrl.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="size-4" /> Add
            </button>
          </div>

          {feedError && (
            <p className="text-xs text-red-500">{feedError}</p>
          )}

          {feeds.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No feeds added yet. Try{" "}
              <code className="text-primary">https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best</code>
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {feeds.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 bg-background/50"
                >
                  <div className="min-w-0">
                    {f.name && (
                      <div className="text-sm font-medium truncate">
                        {f.name}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground truncate">
                      {f.url}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFeed(f.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                    aria-label="Remove feed"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* About / Data Section */}
        <section className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-card-foreground">Data & Privacy</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Download className="size-4" /> Export Backup (JSON)
            </button>
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent cursor-pointer">
              <Upload className="size-4" /> Import Backup
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                }}
              />
            </label>
          </div>
          {importMsg && (
            <p className="text-xs text-muted-foreground">{importMsg}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Your journal entries and API key are stored locally in your browser
            using localStorage. No data is sent to our servers except FRED API
            requests (which go directly to the St. Louis Fed).
          </p>
          <button
            onClick={() => {
              if (confirm("Clear all local journal data? This cannot be undone.")) {
                localStorage.removeItem("journal_entries");
                localStorage.removeItem("journal_day_journals");
                localStorage.removeItem("fred_api_key");
                setApiKey("");
                setSaved(false);
                setTestResult(null);
              }
            }}
            className="inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/20"
          >
            Clear All Local Data
          </button>
        </section>
      </main>
    </div>
  );
}
