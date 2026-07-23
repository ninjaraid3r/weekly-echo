import { useEffect, useState } from "react";

type Session = {
  key: string;
  label: string;
  color: string; // tailwind bg color for the dot
  glow: string; // box-shadow color
};

const SESSIONS: Record<string, Session> = {
  asia: { key: "asia", label: "Asia", color: "bg-red-500", glow: "#ef4444" },
  london: { key: "london", label: "London", color: "bg-blue-500", glow: "#3b82f6" },
  premarket: { key: "premarket", label: "Pre-Market", color: "bg-orange-500", glow: "#f97316" },
  news: { key: "news", label: "News", color: "bg-purple-500", glow: "#a855f7" },
  nyam: { key: "nyam", label: "NYAM", color: "bg-green-500", glow: "#22c55e" },
  lunch: { key: "lunch", label: "Lunch", color: "bg-slate-400", glow: "#94a3b8" },
  nypm: { key: "nypm", label: "NYPM", color: "bg-teal-500", glow: "#14b8a6" },
  power: { key: "power", label: "Power Hour", color: "bg-yellow-400", glow: "#facc15" },
  closed: { key: "closed", label: "Closed", color: "bg-neutral-500", glow: "#737373" },
};

// Returns ET date parts using Intl for correct DST handling.
function getEtParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return {
    hour: parseInt(parts.hour, 10) % 24,
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
  };
}

function currentSessionKey(d: Date): string {
  const { hour, minute } = getEtParts(d);
  const m = hour * 60 + minute;
  // ranges in minutes-from-midnight ET
  // Priority order matters; check overriding windows first.
  if (m >= 8 * 60 + 30 && m < 8 * 60 + 45) return "news"; // 8:30-8:45
  if (m >= 6 * 60 && m < 8 * 60 + 30) return "premarket"; // 6:00-8:30
  if (m >= 9 * 60 + 30 && m < 11 * 60 + 30) return "nyam"; // 9:30-11:30
  if (m >= 11 * 60 + 30 && m < 13 * 60 + 30) return "lunch"; // 11:30-13:30
  if (m >= 13 * 60 + 30 && m < 15 * 60) return "nypm"; // 13:30-15:00
  if (m >= 15 * 60 && m < 16 * 60) return "power"; // 15:00-16:00
  // London: 1:30 - 11:00 (outside the overriding windows above)
  if (m >= 1 * 60 + 30 && m < 11 * 60) return "london";
  // Asia: 18:00 - next-day 1:30
  if (m >= 18 * 60 || m < 1 * 60 + 30) return "asia";
  return "closed";
}

function formatClock(d: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return fmt.format(d);
}

export function SessionClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return <div className="h-14 border-b border-border bg-card/60" />;
  }

  const sessionKey = currentSessionKey(now);
  const session = SESSIONS[sessionKey];
  const isPower = sessionKey === "power";
  const etClock = formatClock(now, "America/New_York");
  const ptClock = formatClock(now, "America/Los_Angeles");

  const lightOrder: Array<keyof typeof SESSIONS> = [
    "asia",
    "london",
    "premarket",
    "news",
    "nyam",
    "lunch",
    "nypm",
  ];

  return (
    <div className="border-b border-border bg-card/70 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 flex flex-col gap-2">
        {/* Digital clocks */}
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono font-bold text-2xl tabular-nums tracking-wider"
              style={{ color: "#7dd3fc", textShadow: "0 0 12px rgba(125,211,252,0.55)" }}
            >
              {ptClock}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">PT</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono font-bold text-2xl tabular-nums tracking-wider"
              style={{ color: "#ef4444", textShadow: "0 0 12px rgba(239,68,68,0.55)" }}
            >
              {etClock}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">ET</span>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            Session: <span className="font-semibold text-foreground">{session.label}</span>
          </div>
        </div>

        {/* Session lights */}
        <div className="flex items-center gap-2 flex-wrap">
          {lightOrder.map((k) => {
            const s = SESSIONS[k];
            const active = sessionKey === k;
            return (
              <div key={k} className="flex items-center gap-1.5">
                <span
                  className={`size-3 rounded-full ${s.color} transition-opacity ${active ? "opacity-100" : "opacity-25"}`}
                  style={active ? { boxShadow: `0 0 10px 2px ${s.glow}` } : undefined}
                  aria-label={s.label}
                  title={s.label}
                />
                <span
                  className={`text-[10px] uppercase tracking-wide ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Power hour ticker tape */}
      {isPower && (
        <div className="overflow-hidden bg-yellow-400 text-black border-t border-yellow-500">
          <div className="whitespace-nowrap py-1 font-bold tracking-[0.3em] text-sm animate-[ticker_18s_linear_infinite]">
            {Array.from({ length: 8 })
              .map(() => "★ POWER HOUR ★ POWER HOUR ★ POWER HOUR ★ POWER HOUR ")
              .join("")}
          </div>
        </div>
      )}
    </div>
  );
}