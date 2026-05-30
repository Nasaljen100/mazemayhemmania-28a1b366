import { useState, useRef } from "react";
import { useAccountStore } from "../store/accountStore";

type Mode = "login" | "register";

export default function AuthScreen({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const login = useAccountStore((s) => s.login);
  const register = useAccountStore((s) => s.register);
  const uploadAvatar = useAccountStore((s) => s.uploadAvatar);
  const loading = useAccountStore((s) => s.loading);
  const error = useAccountStore((s) => s.error);
  const setError = useAccountStore((s) => s.setError);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setError(null);
    if (!username.trim() || !password.trim()) { setError("Fill in all fields"); return; }
    let ok = false;
    if (mode === "login") {
      ok = await login(username.trim(), password);
    } else {
      ok = await register(username.trim(), password);
      if (ok && avatarPreview) await uploadAvatar(avatarPreview);
    }
    if (ok) onBack();
  };

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: "radial-gradient(ellipse at 50% 40%, #0d1a30 0%, #030810 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Courier New', monospace", color: "#fff",
    }}>
      <div style={{
        width: "min(90%, 340px)",
        background: "rgba(0,0,0,0.7)",
        border: "2px solid rgba(255,255,255,0.12)",
        padding: "28px 28px",
      }}>
        {/* Tab switcher */}
        <div style={{ display: "flex", marginBottom: 22, borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
          {(["login", "register"] as Mode[]).map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(null); }}
              style={{
                flex: 1, padding: "9px 0", background: "none",
                border: "none", borderBottom: mode === m ? "2px solid #ffee22" : "2px solid transparent",
                color: mode === m ? "#ffee22" : "rgba(255,255,255,0.4)",
                fontFamily: "inherit", fontSize: 12, fontWeight: "bold",
                cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase",
                marginBottom: -2,
              }}
            >
              {m === "login" ? "LOG IN" : "CREATE ACCOUNT"}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 16, fontWeight: "bold", color: "#ffee22", marginBottom: 20, letterSpacing: "0.08em" }}>
          {mode === "login" ? "Welcome back" : "Join Level Hinter"}
        </div>

        {/* Avatar picker (register only) */}
        {mode === "register" && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 56, height: 56, borderRadius: 0,
                border: "2px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.05)",
                cursor: "pointer", overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {avatarPreview
                ? <img src={avatarPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 24, opacity: 0.4 }}>📷</span>
              }
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>PROFILE PHOTO</div>
              <button onClick={() => fileRef.current?.click()}
                style={{
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
                  color: "rgba(255,255,255,0.7)", padding: "5px 10px",
                  fontFamily: "inherit", fontSize: 10, cursor: "pointer",
                }}
              >
                {avatarPreview ? "CHANGE PHOTO" : "UPLOAD PHOTO"}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
          </div>
        )}

        {/* Fields */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.15em" }}>USERNAME</label>
          <input
            value={username} onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={mode === "register" ? "3-20 chars, letters/numbers/_" : "Your username"}
            style={inputStyle}
            autoFocus
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.15em" }}>PASSWORD</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={mode === "register" ? "At least 4 characters" : "Your password"}
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{
            background: "rgba(200,30,30,0.25)", border: "1px solid rgba(255,80,80,0.4)",
            color: "#ff8888", padding: "8px 12px", fontSize: 11, marginBottom: 14,
            letterSpacing: "0.05em",
          }}>
            ✕ {error}
          </div>
        )}

        <button
          onClick={submit} disabled={loading}
          style={{
            width: "100%", padding: "12px 0",
            background: loading ? "#333" : "#1a9933",
            border: "2px solid rgba(255,255,255,0.15)",
            color: "#fff", fontFamily: "inherit", fontSize: 13,
            fontWeight: "bold", letterSpacing: "0.08em",
            cursor: loading ? "default" : "pointer",
            boxShadow: loading ? "none" : "0 0 14px #00aa22",
          }}
        >
          {loading ? "PLEASE WAIT..." : mode === "login" ? "► LOG IN" : "► CREATE ACCOUNT"}
        </button>

        <button onClick={onBack}
          style={{
            width: "100%", marginTop: 10, padding: "9px 0",
            background: "transparent", border: "2px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.4)", fontFamily: "inherit", fontSize: 11,
            cursor: "pointer", letterSpacing: "0.08em",
          }}
        >
          ← BACK TO MENU
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", marginTop: 5,
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.18)",
  color: "#fff", padding: "9px 10px",
  fontFamily: "'Courier New', monospace", fontSize: 13,
  outline: "none", boxSizing: "border-box",
};
