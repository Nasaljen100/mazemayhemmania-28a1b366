import { useState, useEffect } from "react";
import { useAccountStore } from "../store/accountStore";
import { useMultiplayerStore } from "../store/multiplayerStore";
import { lobbyMusic } from "../game/lobbyMusic";
import { sounds } from "../game/sounds";

interface Props {
  onStart: () => void;
  onBack: () => void;
}

export default function LobbyScreen({ onStart, onBack }: Props) {
  const user = useAccountStore(s => s.user);
  const token = useAccountStore(s => s.token);
  const friends = useAccountStore(s => s.friends);
  const fetchFriends = useAccountStore(s => s.fetchFriends);

  const connected = useMultiplayerStore(s => s.connected);
  const lobbyId = useMultiplayerStore(s => s.lobbyId);
  const currentLevel = useMultiplayerStore(s => s.currentLevel);
  const remotePlayers = useMultiplayerStore(s => s.remotePlayers);
  const myColorIndex = useMultiplayerStore(s => s.myColorIndex);
  const error = useMultiplayerStore(s => s.error);
  const connect = useMultiplayerStore(s => s.connect);
  const createAndJoinLobby = useMultiplayerStore(s => s.createAndJoinLobby);
  const joinLobby = useMultiplayerStore(s => s.joinLobby);
  const leaveLobby = useMultiplayerStore(s => s.leaveLobby);
  const setError = useMultiplayerStore(s => s.setError);

  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    lobbyMusic.start();
    if (token) connect(token);
    fetchFriends();
    return () => { lobbyMusic.stop(); };
  }, []);

  async function handleCreate() {
    if (!token) return;
    setCreating(true);
    sounds.menuClick();
    const id = await createAndJoinLobby(token);
    setCreating(false);
    if (id) sounds.friendJoin();
  }

  function handleJoin() {
    if (!joinCode.trim()) return;
    sounds.menuClick();
    setJoining(true);
    joinLobby(joinCode.toUpperCase().trim());
    setTimeout(() => setJoining(false), 1500);
  }

  function handleCopyCode() {
    if (!lobbyId) return;
    navigator.clipboard.writeText(lobbyId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleStartGame() {
    if (!lobbyId) return;
    sounds.levelComplete();
    onStart();
  }

  function handleLeave() {
    sounds.menuClick();
    leaveLobby();
    onBack();
  }

  const allPlayers = [
    ...(user && remotePlayers.every(p => String(p.userId) !== String(user.id)) ? [{
      userId: user.id as any,
      username: user.username,
      colorIndex: myColorIndex,
      x: 0, y: 0, facingRight: true, onGround: false, dead: false, level: currentLevel,
    }] : []),
    ...remotePlayers,
  ];

  const COLORS = ["#55ff22", "#22bbff", "#ffdd00", "#ff5533", "#cc44ff", "#ff88cc"];

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "radial-gradient(ellipse at 50% 40%, #0a1525 0%, #020608 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: "'Courier New', monospace", color: "#eee",
      overflow: "auto", padding: "20px 12px",
    }}>
      {/* Header */}
      <div style={{ width: "100%", maxWidth: 520, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <button onClick={handleLeave} style={btnStyle("#333", "#555")}>← BACK</button>
          <h1 style={{ margin: 0, fontSize: "clamp(18px,4vw,28px)", color: "#22bbff", letterSpacing: 4, textShadow: "0 0 16px #22bbff88" }}>
            🎮 MULTIPLAYER
          </h1>
        </div>
        {!connected && (
          <div style={{ color: "#ffaa22", fontSize: 12, padding: "6px 12px", background: "rgba(255,170,34,0.1)", borderRadius: 6 }}>
            Connecting to server…
          </div>
        )}
        {error && (
          <div style={{ color: "#ff4444", fontSize: 12, padding: "6px 12px", background: "rgba(255,68,68,0.1)", borderRadius: 6, display: "flex", justifyContent: "space-between" }}>
            <span>⚠ {error}</span>
            <span style={{ cursor: "pointer" }} onClick={() => setError(null)}>✕</span>
          </div>
        )}
      </div>

      <div style={{ width: "100%", maxWidth: 520 }}>
        {!lobbyId ? (
          /* — No lobby yet — */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Create */}
            <div style={cardStyle}>
              <div style={{ color: "#22bbff", fontSize: 13, fontWeight: "bold", marginBottom: 12, letterSpacing: 2 }}>CREATE LOBBY</div>
              <button
                onClick={handleCreate}
                disabled={creating || !connected}
                style={btnStyle("#1a6633", "#22993f", creating || !connected)}
              >
                {creating ? "CREATING…" : "⊕ CREATE NEW LOBBY"}
              </button>
              <div style={{ fontSize: 11, color: "#888", marginTop: 8 }}>You'll get a 6-letter code to share with friends</div>
            </div>

            {/* Join */}
            <div style={cardStyle}>
              <div style={{ color: "#22bbff", fontSize: 13, fontWeight: "bold", marginBottom: 12, letterSpacing: 2 }}>JOIN LOBBY</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  onKeyDown={e => e.key === "Enter" && handleJoin()}
                  placeholder="ENTER CODE"
                  style={inputStyle}
                  maxLength={6}
                />
                <button
                  onClick={handleJoin}
                  disabled={joining || !connected || joinCode.length < 6}
                  style={btnStyle("#1a3366", "#2255aa", joining || !connected || joinCode.length < 6)}
                >
                  {joining ? "JOINING…" : "JOIN"}
                </button>
              </div>
            </div>

            {/* Friends in lobbies */}
            {friends.filter(f => f.status === "accepted").length > 0 && (
              <div style={cardStyle}>
                <div style={{ color: "#22bbff", fontSize: 13, fontWeight: "bold", marginBottom: 12, letterSpacing: 2 }}>FRIENDS</div>
                <div style={{ fontSize: 11, color: "#888" }}>Ask a friend for their lobby code to join their game</div>
              </div>
            )}
          </div>
        ) : (
          /* — In lobby — */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Lobby code */}
            <div style={cardStyle}>
              <div style={{ color: "#22bbff", fontSize: 13, fontWeight: "bold", marginBottom: 12, letterSpacing: 2 }}>LOBBY CODE</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  fontSize: "clamp(24px,6vw,36px)", fontWeight: "bold",
                  letterSpacing: 8, color: "#ffee22",
                  textShadow: "0 0 20px #ffee2288",
                  background: "rgba(255,238,34,0.07)",
                  padding: "8px 20px", borderRadius: 8,
                }}>
                  {lobbyId}
                </div>
                <button onClick={handleCopyCode} style={btnStyle("#333", "#555")}>
                  {copied ? "✓ COPIED!" : "📋 COPY"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 8 }}>Share this code with friends so they can join</div>
            </div>

            {/* Level info */}
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#22bbff", fontSize: 13, fontWeight: "bold", marginBottom: 4, letterSpacing: 2 }}>STARTING LEVEL</div>
                  <div style={{ fontSize: 28, fontWeight: "bold", color: "#ffee22" }}>#{currentLevel}</div>
                </div>
                <div style={{ color: "#888", fontSize: 11 }}>Lobby progress is saved<br />when all players leave</div>
              </div>
            </div>

            {/* Players in lobby */}
            <div style={cardStyle}>
              <div style={{ color: "#22bbff", fontSize: 13, fontWeight: "bold", marginBottom: 12, letterSpacing: 2 }}>
                PLAYERS ({allPlayers.length}/6)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {allPlayers.map((p, i) => (
                  <div key={p.userId} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 12px", background: "rgba(255,255,255,0.04)",
                    borderRadius: 6, border: `1px solid ${COLORS[p.colorIndex ?? i] ?? "#333"}44`,
                  }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: 2,
                      background: COLORS[p.colorIndex ?? i] ?? "#fff",
                      boxShadow: `0 0 8px ${COLORS[p.colorIndex ?? i] ?? "#fff"}`,
                    }} />
                    <div style={{ flex: 1, fontSize: 13 }}>
                      {p.username}
                      {p.userId === user?.id && <span style={{ color: "#888", fontSize: 10, marginLeft: 8 }}>(you)</span>}
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22ff44", boxShadow: "0 0 6px #22ff44" }} />
                  </div>
                ))}
                {allPlayers.length === 0 && (
                  <div style={{ color: "#888", fontSize: 12, textAlign: "center", padding: 12 }}>Waiting for players…</div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={handleStartGame}
                style={{ ...btnStyle("#1a6633", "#22993f"), flex: 2, fontSize: 15, padding: "14px" }}
              >
                ▶ START GAME
              </button>
              <button onClick={() => { leaveLobby(); sounds.menuClick(); }} style={{ ...btnStyle("#331111", "#662222"), flex: 1 }}>
                LEAVE
              </button>
            </div>

            <div style={{ fontSize: 11, color: "#666", textAlign: "center" }}>
              Any player can start the game • Lobby level auto-saves
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "16px 20px",
};

function btnStyle(bg: string, hover: string, disabled = false): React.CSSProperties {
  return {
    background: disabled ? "#222" : bg,
    color: disabled ? "#555" : "#fff",
    border: "none",
    borderRadius: 6,
    padding: "10px 16px",
    fontFamily: "'Courier New', monospace",
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 1,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.15s",
    whiteSpace: "nowrap",
  };
}

const inputStyle: React.CSSProperties = {
  flex: 1, background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6, color: "#fff",
  fontFamily: "'Courier New', monospace",
  fontSize: 18, fontWeight: "bold",
  letterSpacing: 6, padding: "10px 14px",
  outline: "none",
  textAlign: "center" as const,
};
