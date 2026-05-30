import { useEffect, useState } from "react";
import { useAccountStore, AccountUser } from "../store/accountStore";
import { sounds } from "../game/sounds";

interface OnlineFriend { userId: number; username: string; xpLevel: number | null; avatarUrl: string | null; }
interface SuggestedUser { id: number; username: string; xp: number; xpLevel: number; avatarUrl: string | null; }

export default function FriendsScreen({ onBack }: { onBack: () => void }) {
  const user = useAccountStore((s) => s.user);
  const token = useAccountStore((s) => s.token);
  const friends = useAccountStore((s) => s.friends);
  const incomingRequests = useAccountStore((s) => s.incomingRequests);
  const fetchFriends = useAccountStore((s) => s.fetchFriends);
  const sendFriendRequest = useAccountStore((s) => s.sendFriendRequest);
  const acceptFriend = useAccountStore((s) => s.acceptFriend);
  const searchUser = useAccountStore((s) => s.searchUser);

  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<AccountUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState("");
  const [onlineFriends, setOnlineFriends] = useState<OnlineFriend[]>([]);
  const [suggested, setSuggested] = useState<SuggestedUser[]>([]);
  const [tab, setTab] = useState<"friends" | "search" | "suggested">("friends");

  useEffect(() => {
    fetchFriends();
    fetchOnline();
    fetchSuggested();
  }, []);

  async function fetchOnline() {
    if (!token) return;
    try {
      const r = await fetch("/api/online/friends", { headers: { "x-session-token": token } });
      if (r.ok) { const d = await r.json(); setOnlineFriends(d.online ?? []); }
    } catch {}
  }

  async function fetchSuggested() {
    if (!token) return;
    try {
      const r = await fetch("/api/users/suggested", { headers: { "x-session-token": token } });
      if (r.ok) { const d = await r.json(); setSuggested(d.users ?? []); }
    } catch {}
  }

  const doSearch = async () => {
    const q = searchQ.trim();
    if (q.length < 1) return;
    setSearching(true);
    sounds.menuClick();

    // If it's a numeric ID, search by ID
    if (/^\d+$/.test(q)) {
      try {
        const r = await fetch(`/api/users/id/${q}`, { headers: { "x-session-token": token! } });
        if (r.ok) { const d = await r.json(); setResults([d.user].filter(u => u.id !== user?.id)); }
        else setResults([]);
      } catch { setResults([]); }
    } else {
      const r = await searchUser(q);
      setResults(r.filter(u => u.id !== user?.id));
    }
    setSearching(false);
  };

  const sendReq = async (friendId: number, username: string) => {
    sounds.menuClick();
    await sendFriendRequest(friendId);
    setMsg(`Request sent to ${username}!`);
    setResults(prev => prev.filter(u => u.id !== friendId));
    setSuggested(prev => prev.filter(u => u.id !== friendId));
    setTimeout(() => setMsg(""), 3000);
  };

  const accept = async (friendId: number) => {
    sounds.xpGain();
    await acceptFriend(friendId);
    setMsg("Friend accepted!");
    setTimeout(() => setMsg(""), 2000);
  };

  const onlineIds = new Set(onlineFriends.map(o => o.userId));
  const acceptedFriends = friends.filter(f => f.status === "accepted");
  const pendingFriends = friends.filter(f => f.status === "pending");

  return (
    <div style={{ width: "100vw", height: "100vh",
      background: "radial-gradient(ellipse at center, #0d1520 0%, #050810 100%)",
      display: "flex", flexDirection: "column",
      fontFamily: "'Courier New', monospace", color: "#fff", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "12px 16px", background: "rgba(0,0,0,0.7)",
        borderBottom: "2px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <button onClick={onBack} style={btnStyle}>← BACK</button>
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#ffee22" }}>
          FRIENDS {onlineFriends.length > 0 && <span style={{ color: "#22ff66", fontSize: 12 }}>● {onlineFriends.length} online</span>}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>YOUR ID: <span style={{ color: "#22bbff", fontWeight: "bold" }}>#{user?.id}</span></div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        {(["friends", "search", "suggested"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "10px 4px", background: tab === t ? "rgba(255,255,255,0.08)" : "transparent",
            border: "none", borderBottom: tab === t ? "2px solid #22bbff" : "2px solid transparent",
            color: tab === t ? "#22bbff" : "rgba(255,255,255,0.4)",
            fontFamily: "inherit", fontSize: "clamp(9px,2vw,11px)", cursor: "pointer",
            letterSpacing: 1, fontWeight: "bold", textTransform: "uppercase",
          }}>
            {t === "friends" ? `Friends (${acceptedFriends.length})` : t === "search" ? "Find Player" : "Suggested"}
          </button>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div style={{ background: "rgba(34,255,100,0.1)", borderBottom: "1px solid rgba(34,255,100,0.2)",
          color: "#22ff66", padding: "8px 16px", fontSize: 12, textAlign: "center" }}>{msg}</div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>

          {/* ── FRIENDS TAB ── */}
          {tab === "friends" && (
            <>
              {/* Incoming requests */}
              {incomingRequests.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionTitle>INCOMING REQUESTS ({incomingRequests.length})</SectionTitle>
                  {incomingRequests.map(req => (
                    <div key={req.id} style={rowStyle}>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: "#ffee22", fontSize: 13 }}>{req.username}</span>
                        <span style={{ color: "#666", fontSize: 10, marginLeft: 8 }}>#{req.userId}</span>
                      </div>
                      <button onClick={() => accept(req.userId)} style={actionBtn("#1a6633", "#22993f")}>✓ ACCEPT</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Online friends first */}
              {onlineFriends.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <SectionTitle>ONLINE NOW</SectionTitle>
                  {onlineFriends.map(f => (
                    <div key={f.userId} style={rowStyle}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22ff66", boxShadow: "0 0 8px #22ff66", flexShrink: 0 }} />
                      {f.avatarUrl && <img src={f.avatarUrl} style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 2 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#22ff66", fontSize: 13, fontWeight: "bold" }}>{f.username}</div>
                        {f.xpLevel && <div style={{ color: "#888", fontSize: 10 }}>LVL {f.xpLevel}</div>}
                      </div>
                      <div style={{ fontSize: 10, color: "#22ff66" }}>ONLINE</div>
                    </div>
                  ))}
                </div>
              )}

              {/* All friends */}
              <SectionTitle>ALL FRIENDS ({acceptedFriends.length})</SectionTitle>
              {acceptedFriends.length === 0 ? (
                <div style={{ color: "#555", fontSize: 12, textAlign: "center", padding: "24px 0" }}>
                  No friends yet. Search for players in the <b style={{ color: "#22bbff" }}>Find Player</b> tab!
                </div>
              ) : (
                acceptedFriends.map(f => (
                  <div key={f.id} style={rowStyle}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: onlineIds.has(f.friendId) ? "#22ff66" : "#444",
                      boxShadow: onlineIds.has(f.friendId) ? "0 0 6px #22ff66" : "none" }} />
                    {f.avatarUrl && <img src={f.avatarUrl} style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 2 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: "bold", color: onlineIds.has(f.friendId) ? "#22ff66" : "#eee" }}>{f.username}</div>
                      <div style={{ color: "#888", fontSize: 10 }}>LVL {f.xpLevel ?? "?"} · {(f.xp ?? 0).toLocaleString()} XP</div>
                    </div>
                    {onlineIds.has(f.friendId) && <span style={{ fontSize: 9, color: "#22ff66" }}>ONLINE</span>}
                  </div>
                ))
              )}

              {/* Pending sent */}
              {pendingFriends.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <SectionTitle>PENDING ({pendingFriends.length})</SectionTitle>
                  {pendingFriends.map(f => (
                    <div key={f.id} style={rowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#aaa" }}>{f.username}</div>
                        <div style={{ fontSize: 10, color: "#666" }}>Waiting for response…</div>
                      </div>
                      <div style={{ fontSize: 10, color: "#888" }}>PENDING</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── SEARCH TAB ── */}
          {tab === "search" && (
            <>
              <SectionTitle>FIND PLAYER</SectionTitle>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
                Search by username <b style={{ color: "#aaa" }}>or</b> player ID (e.g. <b style={{ color: "#22bbff" }}>#42</b>)
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  placeholder="username or #123"
                  style={inputStyle}
                />
                <button onClick={doSearch} disabled={searching}
                  style={actionBtn("#1a55aa", "#2266cc", searching)}>
                  {searching ? "…" : "SEARCH"}
                </button>
              </div>

              {results.map(u => (
                <div key={u.id} style={rowStyle}>
                  {u.avatarUrl && <img src={u.avatarUrl} style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 2 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{u.username} <span style={{ color: "#666", fontSize: 10 }}>#{u.id}</span></div>
                    <div style={{ fontSize: 10, color: "#888" }}>LVL {u.xpLevel} · {u.xp.toLocaleString()} XP</div>
                  </div>
                  <button onClick={() => sendReq(u.id, u.username)} style={actionBtn("#1a4466", "#1a6699")}>+ ADD</button>
                </div>
              ))}

              {results.length === 0 && searchQ && !searching && (
                <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 16 }}>No players found</div>
              )}

              <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(34,187,255,0.05)",
                border: "1px solid rgba(34,187,255,0.1)", borderRadius: 6, fontSize: 11, color: "#888" }}>
                <b style={{ color: "#22bbff" }}>Your player ID:</b> #{user?.id}<br />
                Share your ID so others can find you!
              </div>
            </>
          )}

          {/* ── SUGGESTED TAB ── */}
          {tab === "suggested" && (
            <>
              <SectionTitle>SUGGESTED FRIENDS</SectionTitle>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>Players with similar XP level you might know</div>
              {suggested.length === 0 ? (
                <div style={{ color: "#555", fontSize: 12, textAlign: "center", padding: "24px 0" }}>
                  No suggestions right now. Keep playing to unlock more!
                </div>
              ) : (
                suggested.map(u => (
                  <div key={u.id} style={rowStyle}>
                    {u.avatarUrl && <img src={u.avatarUrl} style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 2 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{u.username} <span style={{ color: "#666", fontSize: 10 }}>#{u.id}</span></div>
                      <div style={{ fontSize: 10, color: "#888" }}>LVL {u.xpLevel} · {u.xp.toLocaleString()} XP</div>
                    </div>
                    <button onClick={() => sendReq(u.id, u.username)} style={actionBtn("#1a4466", "#1a6699")}>+ ADD</button>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em",
      marginBottom: 8, marginTop: 4, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 6 }}>
      {children}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 12px", marginBottom: 6,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6,
};

const btnStyle: React.CSSProperties = {
  padding: "8px 14px", background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)",
  fontFamily: "'Courier New', monospace", fontSize: 11, cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  flex: 1, background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#fff", padding: "9px 10px",
  fontFamily: "'Courier New', monospace", fontSize: 13, outline: "none", borderRadius: 4,
};

function actionBtn(bg: string, hov: string, disabled = false): React.CSSProperties {
  return {
    padding: "7px 14px", background: disabled ? "#333" : bg,
    border: `1px solid rgba(255,255,255,0.15)`, color: disabled ? "#555" : "#fff",
    fontFamily: "'Courier New', monospace", fontSize: 11,
    cursor: disabled ? "not-allowed" : "pointer", fontWeight: "bold",
    borderRadius: 4, whiteSpace: "nowrap",
  };
}
