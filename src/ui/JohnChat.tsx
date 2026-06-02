import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askJohn, loadJohnHistory, runJohnAdmin } from "@/lib/john.functions";
import { supabase } from "../integrations/supabase/client";
import { useAccountStore } from "../store/accountStore";

interface Msg {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
  configPatch?: any;
  adminAction?: any;
}

const C = {
  bgOuter: "rgba(5,8,16,0.92)",
  panel: "linear-gradient(180deg, #0d1520 0%, #050810 100%)",
  header: "linear-gradient(90deg, #1a0d30 0%, #2a0d50 100%)",
  accent: "#ffee22",
  bubbleMe: "linear-gradient(180deg, #2a4d8a 0%, #1a3060 100%)",
  bubbleJohn: "rgba(255,255,255,0.06)",
  border: "rgba(255,238,34,0.25)",
  text: "#fff",
};

export default function JohnChat({ onClose }: { onClose: () => void }) {
  const user = useAccountStore((s) => s.user);
  const ask = useServerFn(askJohn);
  const loadHist = useServerFn(loadJohnHistory);
  const runAdmin = useServerFn(runJohnAdmin);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hey 👋 I'm John. Ask me anything — or tell me what to change in the game.\n\n• I propose CONFIG patches → press **Upload** (20s global reload).\n• I propose ADMIN actions (XP/ban/role/password/weekly) → press **Small Update**." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    loadHist({ data: {} } as any).then((res: any) => {
      if (res?.messages?.length) {
        setMsgs(res.messages.map((m: any) => ({ role: m.role, content: m.content, imageUrl: m.image_url })));
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    const text = input.trim();
    if (!text && !imageUrl) return;
    const next: Msg = { role: "user", content: text, imageUrl };
    const history = [...msgs, next];
    setMsgs(history);
    setInput(""); setImageUrl(null); setBusy(true);
    try {
      const res: any = await ask({
        data: {
          messages: history.map(m => ({ role: m.role, content: m.content + (m.imageUrl ? `\n[image: ${m.imageUrl}]` : "") })),
          imageUrl,
        },
      });
      setMsgs(m => [...m, { role: "assistant", content: res.reply, configPatch: res.configPatch, adminAction: res.adminAction }]);
    } catch (e: any) {
      setMsgs(m => [...m, { role: "assistant", content: `❌ ${e.message ?? "Error"}` }]);
    } finally { setBusy(false); }
  }

  async function pickImage(file: File) {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("john").upload(path, file, { upsert: true });
    if (error) { alert("Upload failed: " + error.message); return; }
    const { data } = supabase.storage.from("john").getPublicUrl(path);
    setImageUrl(data.publicUrl);
  }

  const latestPatch = [...msgs].reverse().find(m => m.role === "assistant" && m.configPatch)?.configPatch;
  const latestAdmin = [...msgs].reverse().find(m => m.role === "assistant" && m.adminAction)?.adminAction;

  async function handleUpload() {
    if (testMode) { alert("Disable Test mode first."); return; }
    if (!latestPatch) { alert("John has not proposed any config changes yet."); return; }
    const { data: cur } = await supabase.from("live_config").select("data").eq("id", 1).maybeSingle();
    const merged = deepMerge((cur as any)?.data ?? {}, latestPatch);
    merged.version = (merged.version ?? 0) + 1;
    await supabase.from("live_config").update({ data: merged, updated_by: user?.id, updated_at: new Date().toISOString() }).eq("id", 1);
    await supabase.from("broadcasts").insert({
      type: "update",
      payload: { message: "John pushed an update — applying…", version: merged.version },
      created_by: user?.id,
    });
    setMsgs(m => [...m, { role: "assistant", content: "✅ Uploaded! All players see a 20s loading screen now." }]);
  }

  async function handleSmallUpdate() {
    if (testMode) { alert("Disable Test mode first."); return; }
    if (!latestAdmin) { alert("John has not proposed any admin action yet."); return; }
    try {
      const res: any = await runAdmin({ data: { action: latestAdmin } });
      setMsgs(m => [...m, { role: "assistant", content: res?.ok ? `✅ ${res.message}` : `❌ ${res?.message ?? "Failed"}` }]);
    } catch (e: any) {
      setMsgs(m => [...m, { role: "assistant", content: `❌ ${e.message ?? "Failed"}` }]);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: C.bgOuter, backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 12, fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        width: "min(580px, 100%)", height: "min(760px, 100%)",
        background: C.panel, overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: "0 0 0 2px rgba(255,238,34,0.35), 0 20px 80px rgba(0,0,0,0.7)",
      }}>
        <div style={{
          background: C.header, color: "#fff", padding: "10px 12px",
          display: "flex", alignItems: "center", gap: 8,
          borderBottom: `2px solid ${C.border}`,
        }}>
          <div style={{
            width: 36, height: 36, background: C.accent, color: "#000",
            display: "grid", placeItems: "center",
            fontWeight: "bold", fontSize: 18, border: "2px solid #000",
          }}>J</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: "bold", color: C.accent, letterSpacing: "0.1em", fontSize: 13 }}>JOHN · MOD AI</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{busy ? "typing…" : testMode ? "🧪 TEST MODE" : "online"}</div>
          </div>
          <button onClick={() => setTestMode(t => !t)} style={{ ...hdrBtn, background: testMode ? "#aa4422" : "rgba(255,255,255,0.1)" }}>{testMode ? "Exit Test" : "Test"}</button>
          {!testMode && (
            <>
              <button onClick={handleSmallUpdate} style={{ ...hdrBtn, background: latestAdmin ? "#22aa55" : "rgba(255,255,255,0.1)" }} title="Apply admin action (XP / ban / role / pw / weekly)">Small Upd.</button>
              <button onClick={handleUpload} style={{ ...hdrBtn, background: latestPatch ? C.accent : "rgba(255,255,255,0.1)", color: latestPatch ? "#000" : "#fff" }}>Upload</button>
            </>
          )}
          <button onClick={onClose} style={hdrBtn}>✕</button>
        </div>

        {testMode ? (
          <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 24, textAlign: "center", background: "rgba(170,68,34,0.08)" }}>
            <div>
              <div style={{ fontSize: 64 }}>🧪</div>
              <div style={{ color: C.accent, fontSize: 16, fontWeight: "bold", margin: "12px 0" }}>TEST MODE ACTIVE</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, maxWidth: 380, lineHeight: 1.5 }}>
                Chat is hidden. Nothing John proposes will be uploaded.<br/>
                Click <b>Exit Test</b> to return to the conversation.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} style={{ flex: 1, padding: 12, overflowY: "auto", background: "rgba(0,0,0,0.4)" }}>
              {msgs.map((m, i) => (
                <div key={i} style={{ display: "flex", marginBottom: 8, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "78%", padding: "8px 12px",
                    background: m.role === "user" ? C.bubbleMe : C.bubbleJohn,
                    border: `2px solid ${m.role === "user" ? "rgba(34,187,255,0.4)" : C.border}`,
                    color: C.text, fontSize: 13, lineHeight: 1.4,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>
                    {m.imageUrl && <img src={m.imageUrl} style={{ maxWidth: "100%", marginBottom: 6 }} />}
                    {m.content}
                    {m.configPatch && (
                      <div style={{ marginTop: 6, padding: 6, background: "rgba(255,238,34,0.12)", border: `1px solid ${C.border}`, fontSize: 10, color: C.accent }}>
                        📦 Config patch ready · press <b>Upload</b>
                      </div>
                    )}
                    {m.adminAction && (
                      <div style={{ marginTop: 6, padding: 6, background: "rgba(34,170,85,0.15)", border: "1px solid rgba(34,170,85,0.4)", fontSize: 10, color: "#66ff99" }}>
                        ⚡ Admin action ({m.adminAction.type}) ready · press <b>Small Upd.</b>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", padding: 8 }}>John is typing…</div>}
            </div>

            <div style={{ background: "rgba(0,0,0,0.5)", padding: 8, display: "flex", gap: 6, alignItems: "center", borderTop: `1px solid ${C.border}` }}>
              <input ref={fileRef} type="file" accept="image/*" hidden
                onChange={e => { const f = e.target.files?.[0]; if (f) pickImage(f); }} />
              <button onClick={() => fileRef.current?.click()} style={iconBtn}>📷</button>
              {imageUrl && <span style={{ fontSize: 10, color: C.accent }}>📎</span>}
              <input
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask John anything…"
                style={{
                  flex: 1, padding: "10px 12px",
                  border: `2px solid ${C.border}`,
                  background: "rgba(0,0,0,0.5)", color: C.text,
                  outline: "none", fontSize: 13, fontFamily: "inherit",
                }}
              />
              <button onClick={send} disabled={busy} style={{ ...iconBtn, background: C.accent, color: "#000" }}>➤</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const hdrBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)",
  padding: "5px 8px", cursor: "pointer", fontSize: 10, fontWeight: "bold",
  fontFamily: "'Courier New', monospace", whiteSpace: "nowrap",
};
const iconBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,238,34,0.3)",
  width: 40, height: 40, cursor: "pointer", fontSize: 16, color: "#fff",
  display: "grid", placeItems: "center",
};

function deepMerge(a: any, b: any): any {
  if (Array.isArray(b)) return b;
  if (b && typeof b === "object") {
    const out: any = { ...(a ?? {}) };
    for (const k of Object.keys(b)) out[k] = deepMerge(a?.[k], b[k]);
    return out;
  }
  return b;
}