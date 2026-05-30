import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { useAccountStore } from "../store/accountStore";
import { apiUrl } from "../lib/gameApi";

interface Row {
  username: string;
  xp: number;
  xpLevel: number;
  cleared: number;
  isYou?: boolean;
}

export default function Leaderboard() {
  const setScreen = useGameStore((s) => s.setScreen);
  const completedLevels = useGameStore((s) => s.completedLevels);
  const user = useAccountStore((s) => s.user);
  const token = useAccountStore((s) => s.token);
  const friends = useAccountStore((s) => s.friends);
  const fetchFriends = useAccountStore((s) => s.fetchFriends);

  const [remote, setRemote] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (token) fetchFriends(); }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(apiUrl("/leaderboard"), { headers: { "x-session-token": token } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { rows?: Row[] }) => setRemote(d.rows ?? null))
      .catch(() => setRemote(null))
      .finally(() => setLoading(false));
  }, [token]);

  // Local fallback: you + accepted friends, ranked by XP
  const localRows: Row[] = [
    ...(user ? [{ username: user.username, xp: user.xp, xpLevel: user.xpLevel, cleared: completedLevels.size, isYou: true }] : [{ username: "GUEST", xp: 0, xpLevel: 1, cleared: completedLevels.size, isYou: true }]),
    ...friends.filter(f => f.status === "accepted").map(f => ({
      username: f.username ?? `User #${f.friendId}`,
      xp: f.xp ?? 0, xpLevel: f.xpLevel ?? 1, cleared: 0,
    })),
  ].sort((a, b) => b.xp - a.xp || b.cleared - a.cleared);

  const rows = remote && remote.length ? remote : localRows;

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
          🏆 LEADERBOARD
        </div>
        <div style={{ width: 80 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <div style={{ maxWidth: 540, margin: "0 auto" }}>
          {!token && (
            <div style={{ padding: 12, background: "rgba(255,200,40,0.1)", border: "2px solid rgba(255,200,40,0.3)", marginBottom: 14, fontSize: 12, color: "#ffcc44" }}>
              Log in to compete on the global leaderboard. Showing local progress.
            </div>
          )}
          {loading && <div style={{ textAlign: "center", color: "#888" }}>Loading…</div>}
          {!remote && token && !loading && (
            <div style={{ padding: 10, fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>
              Global leaderboard offline — showing you + friends.
            </div>
          )}

          {rows.map((r, i) => (
            <div key={r.username + i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", marginBottom: 6,
              background: r.isYou ? "rgba(255,220,40,0.12)" : "rgba(255,255,255,0.04)",
              border: `2px solid ${r.isYou ? "#ffee22" : "rgba(255,255,255,0.08)"}`,
            }}>
              <div style={{ width: 32, fontSize: 18, fontWeight: "bold",
                color: i === 0 ? "#ffcc00" : i === 1 ? "#cccccc" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.4)" }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", color: r.isYou ? "#ffee22" : "white" }}>{r.username}{r.isYou ? " (you)" : ""}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>LVL {r.xpLevel} · {r.cleared} cleared</div>
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