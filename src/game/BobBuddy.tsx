import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useGameStore } from "../store/gameStore";
import { useLiveConfigStore } from "../store/liveConfigStore";
import { askBob } from "../lib/bob.functions";

const FALLBACK_TIPS: Record<number, string> = {
  1: "Hi! I'm BOB. Arrows/WASD move, SPACE jumps (twice!), SHIFT dashes.",
  2: "Spikes hurt. A lot. Jump them.",
  3: "Some platforms wiggle. Time it.",
  4: "Disappearing tiles fade after you stand. Keep moving!",
  5: "Pop-up spikes hide. Watch the cracks.",
  6: "Trolls patrol. Don't touch the green guys.",
  7: "Spikes AND trolls. You got this.",
  8: "Dash + double jump = long gaps no problem.",
  9: "Moving spikes. Yes, really.",
  10: "Welcome to chaos. Good luck.",
};

export default function BobBuddy() {
  const screen = useGameStore((s) => s.screen);
  const level = useGameStore((s) => s.currentLevel);
  const cfg = useLiveConfigStore((s) => s.config);
  const ask = useServerFn(askBob);

  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const [showAsk, setShowAsk] = useState(false);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const lastLevelRef = useRef<number>(-1);

  function pickFallback(lv: number) {
    return (cfg as any)?.bob?.tips?.[String(lv)]
      ?? FALLBACK_TIPS[lv]
      ?? `Level ${lv}: stay sharp.`;
  }

  useEffect(() => {
    if (!["playing", "practice", "multiplayer"].includes(screen)) {
      setVisible(false); setShowAsk(false);
      return;
    }
    if (lastLevelRef.current === level) return;
    lastLevelRef.current = level;
    setText(pickFallback(level));
    setTyped("");
    setVisible(true);
    // Try OpenAI in the background; replace text if it comes back in time.
    ask({ data: { level } }).then((res: any) => {
      if (res?.reply && lastLevelRef.current === level) {
        setText(res.reply); setTyped("");
      }
    }).catch(() => {});
    const t = setTimeout(() => setVisible(false), 12_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, level]);

  useEffect(() => {
    if (!visible) return;
    let i = 0;
    const iv = setInterval(() => {
      i++; setTyped(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, 24);
    return () => clearInterval(iv);
  }, [visible, text]);

  async function sendQuestion() {
    const q = question.trim();
    if (!q) return;
    setThinking(true);
    try {
      const res: any = await ask({ data: { level, question: q } });
      setText(res?.reply ?? "(BOB shrugged)");
      setTyped(""); setVisible(true); setShowAsk(false); setQuestion("");
    } finally { setThinking(false); }
  }

  if (!["playing", "practice", "multiplayer"].includes(screen)) return null;

  return (
    <>
      {/* Floating "ASK BOB" button (always available in-game) */}
      {!showAsk && (
        <button
          onClick={() => setShowAsk(true)}
          style={{
            position: "fixed", top: 12, right: 12, zIndex: 51,
            width: 44, height: 44, background: "#22bbff",
            border: "3px solid #000", cursor: "pointer",
            fontSize: 18, fontWeight: "bold", color: "#fff",
            boxShadow: "0 0 12px #22bbff88",
          }}
          title="Ask BOB"
        >B?</button>
      )}

      {showAsk && (
        <div style={{
          position: "fixed", top: 12, right: 12, zIndex: 52,
          background: "#0d1520", border: "3px solid #22bbff",
          padding: 10, width: 280, fontFamily: "'Courier New', monospace",
          boxShadow: "0 0 20px rgba(34,187,255,0.4)",
        }}>
          <div style={{ color: "#22bbff", fontWeight: "bold", fontSize: 11, marginBottom: 6 }}>ASK BOB ANYTHING</div>
          <input
            value={question} onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") sendQuestion(); }}
            placeholder="e.g. how do I beat level 12?"
            style={{ width: "100%", padding: 6, background: "#000", color: "#fff", border: "1px solid #22bbff", fontSize: 12, fontFamily: "inherit" }}
            autoFocus
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button onClick={sendQuestion} disabled={thinking} style={{ flex: 1, padding: 6, background: "#22bbff", color: "#000", border: "none", fontWeight: "bold", cursor: "pointer", fontSize: 11 }}>
              {thinking ? "..." : "SEND"}
            </button>
            <button onClick={() => setShowAsk(false)} style={{ padding: 6, background: "#333", color: "#fff", border: "none", cursor: "pointer", fontSize: 11 }}>✕</button>
          </div>
        </div>
      )}

      {visible && (
        <div
          onClick={() => setVisible(false)}
          style={{
            position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
            zIndex: 50, display: "flex", alignItems: "flex-start", gap: 8,
            maxWidth: "min(92vw, 520px)",
            fontFamily: "'Courier New', monospace",
            pointerEvents: "auto", cursor: "pointer",
          }}
        >
          <div style={{
            width: 44, height: 44, background: "#22bbff",
            border: "3px solid #000", boxShadow: "0 0 12px #22bbff88",
            display: "grid", gridTemplateColumns: "repeat(8, 1fr)",
            gridTemplateRows: "repeat(8, 1fr)", flexShrink: 0,
          }}>
            {Array.from({ length: 64 }).map((_, i) => {
              const x = i % 8, y = Math.floor(i / 8);
              const eye = (y === 2 || y === 3) && (x === 2 || x === 5);
              const mouth = y === 5 && x >= 2 && x <= 5;
              return <div key={i} style={{ background: eye || mouth ? "#000" : "transparent" }} />;
            })}
          </div>
          <div style={{
            position: "relative",
            background: "#fff", color: "#111",
            border: "3px solid #000", padding: "8px 12px",
            fontSize: 13, lineHeight: 1.3, minHeight: 38, minWidth: 120,
            boxShadow: "4px 4px 0 rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontWeight: "bold", fontSize: 10, color: "#0066aa", marginBottom: 2 }}>BOB</div>
            {typed}
            {typed.length < text.length && <span style={{ opacity: 0.6 }}>▋</span>}
          </div>
        </div>
      )}
    </>
  );
}