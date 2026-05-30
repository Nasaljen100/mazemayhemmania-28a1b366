import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { TOTAL_LEVELS } from "../game/gameConfig";
import { SeededRandom } from "../game/seededRandom";

// ISO-week-based seed so the same 7 levels appear for everyone on the same week.
function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${week}`;
}

function pickWeeklyLevels(key: string): number[] {
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) | 0;
  const rng = new SeededRandom(seed >>> 0);
  const picks = new Set<number>();
  while (picks.size < 7) picks.add(rng.int(1, TOTAL_LEVELS));
  return [...picks].sort((a, b) => a - b);
}

function msUntilNextWeek(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + ((8 - (now.getUTCDay() || 7)) % 7 || 7));
  next.setUTCHours(0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function fmtCountdown(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

const LS_DONE = "mmm:weekly:done";
function loadDone(): Record<string, number[]> {
  if (typeof localStorage === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_DONE) ?? "{}"); } catch { return {}; }
}

export default function WeeklyChallenges() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startLevel = useGameStore((s) => s.startLevel);
  const completedLevels = useGameStore((s) => s.completedLevels);

  const wk = weekKey();
  const levels = useMemo(() => pickWeeklyLevels(wk), [wk]);
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick(t => t + 1), 60_000); return () => clearInterval(i); }, []);

  const done = loadDone()[wk] ?? [];
  const clearedThisWeek = levels.filter(n => done.includes(n) || completedLevels.has(n));

  // Persist any newly-cleared weekly levels
  useEffect(() => {
    const cur = loadDone();
    const set = new Set(cur[wk] ?? []);
    let changed = false;
    for (const n of levels) if (completedLevels.has(n) && !set.has(n)) { set.add(n); changed = true; }
    if (changed) { cur[wk] = [...set]; localStorage.setItem(LS_DONE, JSON.stringify(cur)); }
  }, [completedLevels, levels, wk]);

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "radial-gradient(ellipse at center, #0d2010 0%, #04060a 100%)",
      color: "white", fontFamily: "'Courier New', monospace",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 16px", background: "rgba(0,0,0,0.7)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "2px solid rgba(255,255,255,0.08)",
      }}>
        <button onClick={() => setScreen("menu")} style={btn}>← MENU</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: "bold", color: "#44ff88", textShadow: "0 0 12px #00aa44" }}>
            🤖 WEEKLY AI LEVELS
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em" }}>
            {wk} · NEW IN {fmtCountdown(msUntilNextWeek())}
          </div>
        </div>
        <div style={{ width: 80 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ maxWidth: 540, margin: "0 auto" }}>
          <div style={{ padding: 14, background: "rgba(68,255,136,0.08)", border: "2px solid rgba(68,255,136,0.25)", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#88ffaa", lineHeight: 1.5 }}>
              AI picks 7 levels every Monday and the validator guarantees they're all beatable.
              Clear all 7 for the weekly badge.
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#ffee22" }}>
              Progress: {clearedThisWeek.length} / 7
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.1)", marginTop: 4 }}>
              <div style={{ height: "100%", width: `${(clearedThisWeek.length / 7) * 100}%`, background: "#44ff88" }} />
            </div>
          </div>

          {levels.map((n, i) => {
            const isDone = done.includes(n) || completedLevels.has(n);
            return (
              <button key={n} onClick={() => startLevel(n)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  width: "100%", padding: "12px 14px", marginBottom: 6,
                  background: isDone ? "rgba(68,255,136,0.12)" : "rgba(255,255,255,0.04)",
                  border: `2px solid ${isDone ? "#44ff88" : "rgba(255,255,255,0.1)"}`,
                  color: "white", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}
              >
                <div style={{ width: 28, fontWeight: "bold", color: "rgba(255,255,255,0.4)" }}>#{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold" }}>Level {n}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                    {isDone ? "✓ Cleared this week" : "Tap to play"}
                  </div>
                </div>
                <div style={{ fontSize: 18 }}>{isDone ? "✓" : "▶"}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.15)",
  color: "white", padding: "7px 14px", cursor: "pointer",
  fontFamily: "inherit", fontSize: 12,
};