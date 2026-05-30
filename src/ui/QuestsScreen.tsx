import { useEffect } from "react";
import { useAccountStore } from "../store/accountStore";
import { useGameStore } from "../store/gameStore";

export default function QuestsScreen({ onBack }: { onBack: () => void }) {
  const quests = useAccountStore((s) => s.quests);
  const fetchQuests = useAccountStore((s) => s.fetchQuests);
  const user = useAccountStore((s) => s.user);
  const completedLevels = useGameStore((s) => s.completedLevels);
  const totalDeaths = useGameStore((s) => s.totalDeaths);
  const maxUnlocked = useGameStore((s) => s.maxUnlocked);

  useEffect(() => { fetchQuests(); }, []);

  function getProgress(type: string, target: number): number {
    if (type === "levels_completed") return Math.min(target, completedLevels.size);
    if (type === "total_deaths") return Math.min(target, totalDeaths);
    if (type === "max_level") return Math.min(target, maxUnlocked);
    return 0;
  }

  const xpToNextLevel = user ? Math.pow(user.xpLevel, 2) * 50 : 0;
  const xpInLevel = user ? user.xp - Math.pow(user.xpLevel - 1, 2) * 50 : 0;
  const xpPct = xpToNextLevel > 0 ? Math.min(1, xpInLevel / xpToNextLevel) : 0;

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "radial-gradient(ellipse at center, #0d1520 0%, #050810 100%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'Courier New', monospace", color: "#fff", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px", background: "rgba(0,0,0,0.7)",
        borderBottom: "2px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <button onClick={onBack} style={btnStyle}>← BACK</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: "bold", color: "#ffee22" }}>QUESTS</div>
          {user && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>XP: {user.xp.toLocaleString()} · LEVEL {user.xpLevel}</div>}
        </div>
        <div style={{ width: 70 }} />
      </div>

      {/* XP bar */}
      {user && (
        <div style={{ padding: "10px 16px", background: "rgba(0,0,0,0.4)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>
            <span>LEVEL {user.xpLevel}</span>
            <span>{xpInLevel.toLocaleString()} / {xpToNextLevel.toLocaleString()} XP</span>
            <span>LEVEL {user.xpLevel + 1}</span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.1)", position: "relative" }}>
            <div style={{ width: `${xpPct * 100}%`, height: "100%", background: "#ffee22", boxShadow: "0 0 8px #ffaa00" }} />
          </div>
        </div>
      )}

      {/* Quests list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {quests.length === 0 && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", marginTop: 40, fontSize: 13 }}>
            {user ? "Loading quests..." : "Log in to see your quests"}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560, margin: "0 auto" }}>
          {quests.map((q) => {
            const prog = getProgress(q.type, q.target);
            const pct = Math.min(1, prog / q.target);
            return (
              <div key={q.id} style={{
                background: q.completed ? "rgba(0,160,60,0.12)" : "rgba(255,255,255,0.04)",
                border: `2px solid ${q.completed ? "#22aa55" : "rgba(255,255,255,0.1)"}`,
                padding: "12px 14px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: 13, color: q.completed ? "#44ff88" : "#fff" }}>
                      {q.completed ? "✓ " : ""}{q.title}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{q.desc}</div>
                  </div>
                  <div style={{
                    fontWeight: "bold", fontSize: 12, color: "#ffee22",
                    whiteSpace: "nowrap", marginLeft: 12,
                  }}>
                    +{q.xp} XP
                  </div>
                </div>
                {!q.completed && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
                      <span>{prog.toLocaleString()} / {q.target.toLocaleString()}</span>
                      <span>{Math.round(pct * 100)}%</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.08)" }}>
                      <div style={{ width: `${pct * 100}%`, height: "100%", background: "#3366cc" }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.15)",
  color: "white", padding: "7px 14px", borderRadius: 0,
  cursor: "pointer", fontFamily: "inherit", fontSize: 12,
};
