import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { useAccountStore } from "../store/accountStore";

interface Row {
  id: string;
  username: string;
  avatarUrl: string | null;
  xp: number;
  xpLevel: number;
  isYou?: boolean;
}

export default function Leaderboard() {
  const setScreen = useGameStore((s) => s.setScreen);
  const user = useAccountStore((s) => s.user);
  const fetchGlobal = useAccountStore((s) => s.fetchGlobalLeaderboard);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchGlobal(100).then((r) => {
      const withYou = r.map((p) => ({ ...p, isYou: p.id === user?.id }));
      setRows(withYou);
    }).finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "radial-gradient(ellipse at center, #120820 0%, #04030a 100%)",
      color: "white", fontFamily: "'Courier New', monospace",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 16px", background: "rgba(0,0,0,0.7)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "2px solid rgba(255,255,255,0.08)",
      }}>
        <button onClick={() => setScreen("menu")} style={btn}>← MENU</button>
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#ffee22", textShadow: "0 0 12px #ffaa00" }}>
          🏆 GLOBAL LEADERBOARD
        </div>
        <div style={{ width: 80 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <div style={{ maxWidth: 540, margin: "0 auto" }}>
          {loading && <div style={{ textAlign: "center", color: "#888" }}>Loading…</div>}
          {!loading && rows.length === 0 && (
            <div style={{ textAlign: "center", color: "#888", padding: 20 }}>No players yet.</div>
          )}
          {rows.map((r, i) => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", marginBottom: 6,
              background: r.isYou ? "rgba(255,220,40,0.12)" : "rgba(255,255,255,0.04)",
              border: `2px solid ${r.isYou ? "#ffee22" : "rgba(255,255,255,0.08)"}`,
            }}>
              <div style={{ width: 32, fontSize: 18, fontWeight: "bold",
                color: i === 0 ? "#ffcc00" : i === 1 ? "#cccccc" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.4)" }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </div>
              {r.avatarUrl && <img src={r.avatarUrl} style={{ width: 28, height: 28, objectFit: "cover", border: "1px solid rgba(255,255,255,0.2)" }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: "bold", color: r.isYou ? "#ffee22" : "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.username}{r.isYou ? " (you)" : ""}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>LVL {r.xpLevel}</div>
              </div>
              <div style={{ fontWeight: "bold", color: "#22ccff" }}>{r.xp.toLocaleString()} XP</div>
            </div>
          ))}
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