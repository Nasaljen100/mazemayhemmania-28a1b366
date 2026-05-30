import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { useAccountStore } from "../store/accountStore";

const TOTAL = 628;
const SKIP_COST = 75;
const PER_PAGE = 100;
const COLS = 10;

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.({ navigationUI: "hide" })?.catch(() => {});
}

export default function LevelSelect() {
  const startLevel = useGameStore((s) => s.startLevel);
  const setScreen = useGameStore((s) => s.setScreen);
  const maxUnlocked = useGameStore((s) => s.maxUnlocked);
  const completedLevels = useGameStore((s) => s.completedLevels);
  const deathsPerLevel = useGameStore((s) => s.deathsPerLevel);
  const user = useAccountStore((s) => s.user);
  const spendXpToSkip = useAccountStore((s) => s.spendXpToSkip);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  function go(n: number) {
    if (n < 1 || n > TOTAL) return;
    if (n > maxUnlocked) return;
    startLevel(n);
  }
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(search, 10);
    if (!isNaN(n)) {
      if (n > maxUnlocked) {
        alert(`Level ${n} is locked. Reach it first or use Skip.`);
        return;
      }
      go(n);
    }
  }
  function handleSkip() {
    const nextLocked = maxUnlocked;
    if (nextLocked >= TOTAL) return;
    if (!user) { alert("Log in to spend XP on level skips."); return; }
    if (user.xp < SKIP_COST) { alert(`Need ${SKIP_COST} XP (you have ${user.xp}).`); return; }
    if (!confirm(`Skip level ${nextLocked} for ${SKIP_COST} XP?`)) return;
    const ok = spendXpToSkip(nextLocked + 1, SKIP_COST);
    if (!ok) alert("Could not skip.");
  }

  const totalPages = Math.ceil(TOTAL / PER_PAGE);
  const start = page * PER_PAGE + 1;
  const end = Math.min((page + 1) * PER_PAGE, TOTAL);
  const levels = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "radial-gradient(ellipse at center, #0d1520 0%, #050810 100%)",
      display: "flex", flexDirection: "column",
      overflow: "hidden", color: "white", fontFamily: "'Courier New', monospace",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "2px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        <button onClick={() => setScreen("menu")} style={btnStyle}>← MENU</button>
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontSize: 18, fontWeight: "bold", color: "#ffee22",
            textShadow: "0 0 12px #ffaa00",
          }}>
            LEVEL HINTER
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em" }}>
            {completedLevels.size} / {TOTAL} CLEARED
          </div>
        </div>
        <button onClick={toggleFullscreen} style={btnStyle}>⛶</button>
      </div>

      {/* Search + Skip bar */}
      <div style={{
        display: "flex", gap: 8, padding: "8px 12px", alignItems: "center",
        background: "rgba(0,0,0,0.5)", flexWrap: "wrap",
      }}>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 6, flex: 1, minWidth: 200 }}>
          <input
            type="number" min={1} max={TOTAL} value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Jump to level…"
            style={{
              flex: 1, padding: "7px 10px", border: "2px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)", color: "white",
              fontFamily: "inherit", fontSize: 12, borderRadius: 0, minWidth: 0,
            }}
          />
          <button type="submit" style={btnStyle}>GO</button>
        </form>
        <button
          onClick={handleSkip}
          disabled={!user || user.xp < SKIP_COST || maxUnlocked >= TOTAL}
          style={{
            ...btnStyle,
            background: user && user.xp >= SKIP_COST ? "rgba(180,140,40,0.3)" : "rgba(255,255,255,0.04)",
            border: "2px solid " + (user && user.xp >= SKIP_COST ? "#ffaa22" : "rgba(255,255,255,0.1)"),
            color: user && user.xp >= SKIP_COST ? "#ffee22" : "rgba(255,255,255,0.35)",
            cursor: user && user.xp >= SKIP_COST ? "pointer" : "not-allowed",
          }}
          title={user ? `Skip lvl ${maxUnlocked} for ${SKIP_COST} XP (you have ${user.xp})` : "Log in to spend XP"}
        >
          ⏭ SKIP −{SKIP_COST} XP
        </button>
      </div>

      {/* Page tabs */}
      <div style={{
        display: "flex", gap: 4, padding: "8px 12px",
        overflowX: "auto", background: "rgba(0,0,0,0.35)",
        flexShrink: 0,
      }}>
        {Array.from({ length: totalPages }).map((_, pi) => {
          const ps = pi * PER_PAGE + 1;
          const pe = Math.min((pi + 1) * PER_PAGE, TOTAL);
          const unlocked = ps <= maxUnlocked;
          return (
            <button
              key={pi}
              onClick={() => setPage(pi)}
              disabled={!unlocked}
              style={{
                padding: "5px 10px",
                borderRadius: 0,
                border: `2px solid ${page === pi ? "#ffee22" : "rgba(255,255,255,0.12)"}`,
                background: page === pi ? "rgba(255,220,34,0.15)" : "rgba(255,255,255,0.04)",
                color: page === pi ? "#ffee22" : unlocked ? "#bbb" : "rgba(255,255,255,0.2)",
                cursor: unlocked ? "pointer" : "default",
                fontFamily: "inherit", fontSize: 11,
                whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {ps}–{pe}
            </button>
          );
        })}
      </div>

      {/* Level grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gap: 6,
          maxWidth: 640,
          margin: "0 auto",
        }}>
          {levels.map((n) => {
            const unlocked = n <= maxUnlocked;
            const done = completedLevels.has(n);
            const deaths = deathsPerLevel[n] || 0;

            const bg = done
              ? "rgba(0,160,60,0.22)"
              : unlocked
              ? "rgba(40,80,180,0.2)"
              : "rgba(255,255,255,0.03)";
            const border = done ? "#22aa55" : unlocked ? "#3366cc" : "rgba(255,255,255,0.08)";
            const textColor = done ? "#44ff88" : unlocked ? "white" : "rgba(255,255,255,0.2)";

            return (
              <button
                key={n}
                onClick={() => unlocked && startLevel(n)}
                title={
                  unlocked
                    ? `Level ${n}${deaths ? ` · ${deaths} deaths` : ""}`
                    : "Locked"
                }
                style={{
                  aspectRatio: "1",
                  background: bg,
                  border: `2px solid ${border}`,
                  borderRadius: 0,
                  color: textColor,
                  fontFamily: "inherit",
                  fontWeight: "bold",
                  fontSize: "clamp(8px, 1.4vw, 12px)",
                  cursor: unlocked ? "pointer" : "default",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  transition: "transform 0.08s, filter 0.08s",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (unlocked) {
                    (e.currentTarget as HTMLElement).style.transform = "scale(1.12)";
                    (e.currentTarget as HTMLElement).style.zIndex = "10";
                    (e.currentTarget as HTMLElement).style.filter = "brightness(1.3)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "";
                  (e.currentTarget as HTMLElement).style.zIndex = "";
                  (e.currentTarget as HTMLElement).style.filter = "";
                }}
              >
                {done ? "✓" : unlocked ? n : "🔒"}
                {deaths > 0 && unlocked && (
                  <span style={{ fontSize: "7px", color: "#ff6644", lineHeight: 1 }}>
                    ×{deaths > 99 ? "99+" : deaths}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        padding: "8px 16px",
        background: "rgba(0,0,0,0.5)",
        display: "flex", gap: 20, justifyContent: "center",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        {[
          { color: "#44ff88", label: "✓ Done" },
          { color: "white", label: "Unlocked" },
          { color: "rgba(255,255,255,0.2)", label: "🔒 Locked" },
        ].map(({ color, label }) => (
          <div key={label} style={{ fontSize: 10, color, letterSpacing: "0.1em" }}>{label}</div>
        ))}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "2px solid rgba(255,255,255,0.15)",
  color: "white",
  padding: "7px 14px",
  borderRadius: 0,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
};
