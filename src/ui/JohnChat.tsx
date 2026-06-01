import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askJohn } from "@/lib/john.functions";
import { supabase } from "../integrations/supabase/client";
import { useAccountStore } from "../store/accountStore";

interface Msg {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
  configPatch?: any;
}

export default function JohnChat({ onClose }: { onClose: () => void }) {
  const user = useAccountStore((s) => s.user);
  const ask = useServerFn(askJohn);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hey 👋 I'm John. Ask me anything, or tell me what to change in the game. I'll prepare a patch — you click Upload to push it to all players." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [testPreview, setTestPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

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
      setMsgs(m => [...m, { role: "assistant", content: res.reply, configPatch: res.configPatch }]);
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

  function handleTest() {
    setTestPreview(true);
    setTimeout(() => setTestPreview(false), 4000);
  }

  async function handleUpload() {
    if (!latestPatch) { alert("John has not proposed any changes yet."); return; }
    // Merge patch into live_config, then broadcast "update".
    const { data: cur } = await supabase.from("live_config").select("data").eq("id", 1).maybeSingle();
    const merged = deepMerge(cur?.data ?? {}, latestPatch);
    merged.version = (merged.version ?? 0) + 1;
    await supabase.from("live_config").update({ data: merged, updated_by: user?.id, updated_at: new Date().toISOString() }).eq("id", 1);
    await supabase.from("broadcasts").insert({
      type: "update",
      payload: { message: "John pushed an update — applying…", version: merged.version },
      created_by: user?.id,
    });
    setMsgs(m => [...m, { role: "assistant", content: "✅ Uploaded! All players see a 20s loading screen now." }]);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 12, fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        width: "min(560px, 100%)", height: "min(720px, 100%)",
        background: "#ECE5DD", borderRadius: 12, overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        {/* WhatsApp-style header */}
        <div style={{
          background: "#075E54", color: "#fff", padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "#25D366", display: "grid", placeItems: "center",
            fontWeight: "bold", fontSize: 18,
          }}>J</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>John</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>{busy ? "typing…" : "online"}</div>
          </div>
          <button onClick={handleTest} style={hdrBtn}>Test</button>
          <button onClick={handleUpload} style={{ ...hdrBtn, background: latestPatch ? "#25D366" : "#444" }}>
            Upload
          </button>
          <button onClick={onClose} style={hdrBtn}>✕</button>
        </div>

        {/* Test preview banner */}
        {testPreview && (
          <div style={{ background: "#FFF3CD", color: "#664d03", padding: "6px 12px", fontSize: 12, textAlign: "center" }}>
            🧪 Test preview — changes applied locally for 4s (not pushed to players)
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} style={{
          flex: 1, padding: 12, overflowY: "auto",
          background: "#ECE5DD",
          backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}>
          {msgs.map((m, i) => (
            <div key={i} style={{
              display: "flex", marginBottom: 8,
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                maxWidth: "75%", padding: "8px 10px", borderRadius: 8,
                background: m.role === "user" ? "#DCF8C6" : "#fff",
                color: "#111", fontSize: 14, lineHeight: 1.35,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
              }}>
                {m.imageUrl && <img src={m.imageUrl} style={{ maxWidth: "100%", borderRadius: 6, marginBottom: 6 }} />}
                {m.content}
                {m.configPatch && (
                  <div style={{ marginTop: 6, padding: 6, background: "#f4f4f4", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "#333" }}>
                    📦 Patch ready · click <b>Upload</b> to push
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ fontSize: 12, color: "#666", padding: 8 }}>John is typing…</div>
          )}
        </div>

        {/* Input */}
        <div style={{ background: "#F0F0F0", padding: 8, display: "flex", gap: 6, alignItems: "center" }}>
          <input ref={fileRef} type="file" accept="image/*" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) pickImage(f); }} />
          <button onClick={() => fileRef.current?.click()} style={iconBtn}>📷</button>
          {imageUrl && <span style={{ fontSize: 10, color: "#075E54" }}>📎 image</span>}
          <input
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask John anything…"
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 20,
              border: "1px solid #ddd", outline: "none", fontSize: 14, background: "#fff",
            }}
          />
          <button onClick={send} disabled={busy} style={{ ...iconBtn, background: "#075E54", color: "#fff" }}>➤</button>
        </div>
      </div>
    </div>
  );
}

const hdrBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.18)", color: "#fff", border: "none",
  padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
};
const iconBtn: React.CSSProperties = {
  background: "#fff", border: "1px solid #ddd", borderRadius: "50%",
  width: 38, height: 38, cursor: "pointer", fontSize: 16,
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