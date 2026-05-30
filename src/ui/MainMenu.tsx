import { apiUrl } from "../lib/gameApi";
import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { useAccountStore } from "../store/accountStore";
import { GAME_VERSION, TOTAL_LEVELS, NEXT_UPDATE, VERSION_HISTORY } from "../game/gameConfig";
import { sounds } from "../game/sounds";
import { lobbyMusic } from "../game/lobbyMusic";

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.({ navigationUI: "hide" })?.catch(() => {});
}

export default function MainMenu() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startLevel = useGameStore((s) => s.startLevel);
  const maxUnlocked = useGameStore((s) => s.maxUnlocked);
  const totalDeaths = useGameStore((s) => s.totalDeaths);
  const completedLevels = useGameStore((s) => s.completedLevels);

  const user = useAccountStore((s) => s.user);
  const token = useAccountStore((s) => s.token);
  const logout = useAccountStore((s) => s.logout);
  const friends = useAccountStore((s) => s.friends);
  const fetchFriends = useAccountStore((s) => s.fetchFriends);

  const xp = user?.xp ?? 0;
  const xpLevel = user?.xpLevel ?? 1;
  const xpToNextLevel = Math.pow(xpLevel, 2) * 50;
  const xpInLevel = xp - Math.pow(xpLevel - 1, 2) * 50;
  const xpPct = xpToNextLevel > 0 ? Math.min(1, xpInLevel / xpToNextLevel) : 0;

  const [onlineFriends, setOnlineFriends] = useState<{ userId: number; username: string }[]>([]);
  const [showVersion, setShowVersion] = useState(false);
  const [musicOn, setMusicOn] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem("mmm:music") !== "off";
  });

  useEffect(() => {
    if (musicOn) lobbyMusic.start(); else lobbyMusic.stop();
    if (typeof localStorage !== "undefined") localStorage.setItem("mmm:music", musicOn ? "on" : "off");
    return () => lobbyMusic.stop();
  }, [musicOn]);

  useEffect(() => {
    if (user) fetchFriends();
  }, [user]);

  useEffect(() => {
    if (!token) return;
    async function fetchOnline() {
      try {
        const r = await fetch(apiUrl("/online/friends"), { headers: { "x-session-token": token! } });
        if (r.ok) { const d = await r.json(); setOnlineFriends(d.online ?? []); }
      } catch {}
    }
    fetchOnline();
    const iv = setInterval(fetchOnline, 30000);
    return () => clearInterval(iv);
  }, [token]);

  function btn(label: string, fn: () => void) {
    sounds.menuClick();
    fn();
  }

  const acceptedFriends = friends.filter(f => f.status === "accepted");
  const onlineCount = onlineFriends.length;

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "radial-gradient(ellipse at 50% 40%, #0d1a30 0%, #030810 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden", position: "relative",
      fontFamily: "'Courier New', monospace",
    }}>
      {/* Pixel grid */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.05,
        backgroundImage: "linear-gradient(#3355aa 1px,transparent 1px),linear-gradient(90deg,#3355aa 1px,transparent 1px)",
        backgroundSize: "24px 24px" }} />

      {/* Top spikes */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", overflow: "hidden", height: 48 }}>
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} style={{ flexShrink: 0, width: 0, height: 0,
            borderLeft: "16px solid transparent", borderRight: "16px solid transparent",
            borderBottom: "48px solid #cc1100", opacity: 0.85, filter: "drop-shadow(0 4px 8px #ff0000)" }} />
        ))}
      </div>

      {/* Version badge (top-left) */}
      <div style={{ position: "absolute", top: 56, left: 16, zIndex: 10 }}>
        <button onClick={() => setMusicOn((v) => !v)} style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          color: musicOn ? "#22ccff" : "rgba(255,255,255,0.3)", fontSize: 14, padding: "4px 8px",
          cursor: "pointer", fontFamily: "inherit", marginRight: 6,
        }} title={musicOn ? "Mute music" : "Play music"}>
          {musicOn ? "🔊" : "🔇"}
        </button>
        <button onClick={() => setShowVersion(!showVersion)} style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.4)", fontSize: 10, padding: "4px 8px",
          cursor: "pointer", fontFamily: "inherit", letterSpacing: 1,
        }}>
          {GAME_VERSION} · {TOTAL_LEVELS} LEVELS
        </button>
        {showVersion && (
          <div style={{
            position: "absolute", top: 30, left: 0, zIndex: 20,
            background: "#0a1020", border: "1px solid rgba(255,255,255,0.15)",
            padding: "12px 16px", minWidth: 220, borderRadius: 4,
          }}>
            <div style={{ color: "#22bbff", fontSize: 11, fontWeight: "bold", marginBottom: 8, letterSpacing: 2 }}>VERSION HISTORY</div>
            {VERSION_HISTORY.map(v => (
              <div key={v.version} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <span style={{ color: "#ffee22", fontSize: 10, fontWeight: "bold" }}>{v.version}</span>
                  <span style={{ color: "#888", fontSize: 10 }}>{v.date}</span>
                </div>
                <div style={{ color: "#aaa", fontSize: 10 }}>{v.note} — {v.totalLevels} levels</div>
              </div>
            ))}
            <div style={{ color: "#555", fontSize: 9, marginTop: 8, borderTop: "1px solid #222", paddingTop: 6 }}>
              Next update: {NEXT_UPDATE}
            </div>
          </div>
        )}
      </div>

      {/* Account badge (top-right) */}
      <div style={{ position: "absolute", top: 56, right: 16, zIndex: 10 }}>
        {user ? (
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
              {user.avatarUrl && (
                <img src={user.avatarUrl} style={{ width: 32, height: 32, objectFit: "cover", border: "2px solid rgba(255,220,30,0.5)" }} />
              )}
              <div>
                <div style={{ fontSize: 12, color: "#ffee22", fontWeight: "bold" }}>{user.username}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>LVL {xpLevel} · {xp.toLocaleString()} XP</div>
                <div style={{ fontSize: 9, color: "#888" }}>ID: #{user.id}</div>
              </div>
            </div>
            <div style={{ width: 120, height: 3, background: "rgba(255,255,255,0.1)", marginTop: 5, marginLeft: "auto" }}>
              <div style={{ width: `${xpPct * 100}%`, height: "100%", background: "#ffee22" }} />
            </div>
            {/* Online friends indicator */}
            {onlineCount > 0 && (
              <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22ff66", boxShadow: "0 0 6px #22ff66" }} />
                <span style={{ fontSize: 9, color: "#22ff66" }}>{onlineCount} friend{onlineCount !== 1 ? "s" : ""} online</span>
              </div>
            )}
            <button onClick={() => logout()} style={{ marginTop: 4, background: "none", border: "none",
              color: "rgba(255,255,255,0.3)", fontFamily: "inherit", fontSize: 9, cursor: "pointer", letterSpacing: "0.1em" }}>
              LOG OUT
            </button>
          </div>
        ) : (
          <button onClick={() => setScreen("auth" as any)} style={{
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.6)", fontFamily: "inherit", fontSize: 10,
            padding: "6px 12px", cursor: "pointer", letterSpacing: "0.1em",
          }}>LOG IN</button>
        )}
      </div>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 24, position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: "clamp(24px,6vw,52px)", fontWeight: 900, color: "#ffee22",
          textShadow: "0 0 30px #ffaa00, 4px 4px 0 #aa6600, -1px -1px 0 #000",
          letterSpacing: "0.12em", lineHeight: 1 }}>MAZE MAYHEM</div>
        <div style={{ fontSize: "clamp(36px,9vw,76px)", fontWeight: 900, color: "#ff3300",
          textShadow: "0 0 30px #ff0000, 4px 4px 0 #660000, -1px -1px 0 #000",
          letterSpacing: "0.18em", lineHeight: 1, marginTop: 4 }}>MANIA</div>
        <div style={{ fontSize: "clamp(10px,2vw,13px)", letterSpacing: "0.3em", color: "rgba(255,255,255,0.35)", marginTop: 10 }}>
          {TOTAL_LEVELS} LEVELS · TRAPS AWAIT
        </div>
        <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "rgba(255,150,0,0.5)", marginTop: 4 }}>
          WATCH FOR THE HINT ●
        </div>
      </div>

      {/* Stats */}
      {(completedLevels.size > 0 || totalDeaths > 0) && (
        <div style={{ display: "flex", gap: "clamp(12px,4vw,28px)", marginBottom: 18, position: "relative", zIndex: 1 }}>
          <StatBox value={completedLevels.size} label="CLEARED" color="#44ff88" />
          <StatBox value={totalDeaths} label="DEATHS" color="#ff5544" />
          <StatBox value={maxUnlocked} label="MAX LV" color="#44aaff" />
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
        position: "relative", zIndex: 1, width: "min(92%, 320px)" }}>
        <MenuBtn label="▶  PLAY" color="#1a9933" glow="#00aa22" onClick={() => { sounds.menuClick(); startLevel(1); }} />
        <MenuBtn label="☰  LEVEL SELECT" color="#aa7700" glow="#886600" onClick={() => { sounds.menuClick(); setScreen("levelselect"); }} />
        {maxUnlocked > 1 && (
          <MenuBtn label={`⏭  CONTINUE LV ${maxUnlocked}`} color="#1a55aa" glow="#1144aa" onClick={() => { sounds.menuClick(); startLevel(maxUnlocked); }} />
        )}

        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          <MenuBtn label="🎯 PRACTICE" color="#334455" glow="#223" onClick={() => { sounds.menuClick(); setScreen("practice" as any); }} half />
          <MenuBtn label={`🎮 MULTI${onlineCount > 0 ? ` (${onlineCount})` : ""}`} color="#1a2a5a" glow="#112244"
            onClick={() => { sounds.menuClick(); if (user) setScreen("lobby" as any); else setScreen("auth" as any); }} half />
        </div>

        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          <MenuBtn label="🤖 WEEKLY AI" color="#1a663a" glow="#0a4422" onClick={() => { sounds.menuClick(); setScreen("weekly" as any); }} half />
          <MenuBtn label="🏆 LEADERBOARD" color="#664422" glow="#442211" onClick={() => { sounds.menuClick(); setScreen("leaderboard" as any); }} half />
        </div>

        {user ? (
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <MenuBtn label="⭐ QUESTS" color="#554400" glow="#443300" onClick={() => { sounds.menuClick(); setScreen("quests" as any); }} half />
            <MenuBtn label={`👥 FRIENDS${acceptedFriends.length > 0 ? ` (${acceptedFriends.length})` : ""}`} color="#2a3a5a" glow="#1a2a4a"
              onClick={() => { sounds.menuClick(); setScreen("friends" as any); }} half />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <MenuBtn label="👤 CREATE ACCOUNT" color="#1a4466" glow="#113355" onClick={() => { sounds.menuClick(); setScreen("auth" as any); }} half />
            <MenuBtn label="🔑 LOG IN" color="#334455" glow="#223344" onClick={() => { sounds.menuClick(); setScreen("auth" as any); }} half />
          </div>
        )}

        <MenuBtn label="⛶  FULLSCREEN" color="#282828" glow="#111" onClick={() => { sounds.menuClick(); toggleFullscreen(); }} />
      </div>

      {/* Controls hint */}
      <div style={{ position: "absolute", bottom: 56, left: 0, right: 0, textAlign: "center",
        color: "rgba(255,255,255,0.22)", fontSize: "clamp(9px,1.5vw,11px)", zIndex: 1, letterSpacing: "0.1em" }}>
        ← → / A D &nbsp;MOVE &nbsp;·&nbsp; SPACE / W / ↑ &nbsp;JUMP &nbsp;·&nbsp; F &nbsp;FULLSCREEN
      </div>

      {/* Bottom spikes */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", overflow: "hidden", height: 48 }}>
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} style={{ flexShrink: 0, width: 0, height: 0,
            borderLeft: "16px solid transparent", borderRight: "16px solid transparent",
            borderTop: "48px solid #cc1100", opacity: 0.85 }} />
        ))}
      </div>
    </div>
  );
}

function StatBox({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontWeight: "bold", fontSize: "clamp(16px,4vw,20px)", color }}>{value}</div>
      <div style={{ fontSize: "clamp(9px,1.5vw,10px)", color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em" }}>{label}</div>
    </div>
  );
}

function MenuBtn({ label, color, glow, onClick, half }: { label: string; color: string; glow: string; onClick: () => void; half?: boolean }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", flex: half ? 1 : undefined,
      padding: "clamp(8px,2vw,12px) 16px",
      background: color, border: "2px solid rgba(255,255,255,0.15)",
      borderRadius: 0, color: "#fff", fontFamily: "'Courier New', monospace",
      fontSize: half ? "clamp(10px,2vw,12px)" : "clamp(12px,2.5vw,14px)",
      fontWeight: "bold", letterSpacing: "0.06em", cursor: "pointer",
      boxShadow: `0 0 14px ${glow}, 0 3px 0 rgba(0,0,0,0.6)`,
      textShadow: "1px 1px 0 rgba(0,0,0,0.5)",
      transition: "transform 0.08s, filter 0.08s",
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.filter = "brightness(1.2)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.filter = ""; }}
    >{label}</button>
  );
}
