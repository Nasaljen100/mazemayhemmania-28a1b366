import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { useLiveConfigStore } from "../store/liveConfigStore";

const INTROS: Record<number, string> = {
  1: "Hi! I'm BOB. Tap or use arrows to move, SPACE to jump. Reach the door!",
  2: "Spikes hurt. A lot. Jump over them.",
  3: "Some platforms wiggle. Time your jumps.",
  4: "Disappearing tiles fade after you stand. Keep moving!",
  5: "Pop-up spikes hide. Watch the ground for cracks!",
  6: "Trolls patrol. Don't touch the green guys.",
  7: "Combo time: spikes AND trolls. You got this.",
  8: "Long jumps need a running start.",
  9: "Moving spikes? Yep. That's a thing now.",
  10: "You made it to 10. From here on: chaos. Good luck.",
};

function tipFor(level: number, cfg: any): string {
  const fromCfg = cfg?.bob?.tips?.[String(level)];
  if (fromCfg) return fromCfg;
  if (INTROS[level]) return INTROS[level];
  const pool = [
    "Tip: don't die.",
    "Spike + jump + door. Easy.",
    "Lava is the floor. Pretend.",
    "Believe in pixel jumps.",
    "If it moves and is red, run.",
    "Patience pays. Sometimes.",
    "I believe in you. Maybe.",
  ];
  return pool[level % pool.length];
}

/** Top-of-screen pixel buddy that talks for 10s with typewriter text. */
export default function BobBuddy() {
  const screen = useGameStore((s) => s.screen);
  const level = useGameStore((s) => s.currentLevel);
  const cfg = useLiveConfigStore((s) => s.config);

  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const lastLevelRef = useRef<number>(-1);

  useEffect(() => {
    if (!["playing", "practice", "multiplayer"].includes(screen)) {
      setVisible(false);
      return;
    }
    if (lastLevelRef.current === level) return;
    lastLevelRef.current = level;
    const msg = tipFor(level, cfg);
    setText(msg);
    setTyped("");
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 10_000);
    return () => clearTimeout(t);
  }, [screen, level, cfg]);

  // Typewriter
  useEffect(() => {
    if (!visible) return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, 28);
    return () => clearInterval(iv);
  }, [visible, text]);

  if (!visible) return null;

  return (
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
      {/* Pixel BOB face */}
      <div style={{
        width: 44, height: 44, background: "#22bbff",
        border: "3px solid #000", boxShadow: "0 0 12px #22bbff88",
        display: "grid", gridTemplateColumns: "repeat(8, 1fr)",
        gridTemplateRows: "repeat(8, 1fr)", flexShrink: 0,
      }}>
        {/* Simple pixel face: eyes + smile */}
        {Array.from({ length: 64 }).map((_, i) => {
          const x = i % 8, y = Math.floor(i / 8);
          const eye = (y === 2 || y === 3) && (x === 2 || x === 5);
          const mouth = y === 5 && x >= 2 && x <= 5;
          return <div key={i} style={{ background: eye || mouth ? "#000" : "transparent" }} />;
        })}
      </div>
      {/* Speech bubble */}
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
  );
}