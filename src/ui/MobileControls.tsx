import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";

export interface MobileInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
  dashPressed: boolean;
  pausePressed: boolean;
  restartPressed: boolean;
  fullscreenPressed: boolean;
}

export const mobileInput: MobileInput = {
  left: false, right: false, jump: false, jumpPressed: false,
  dashPressed: false, pausePressed: false,
  restartPressed: false, fullscreenPressed: false,
};

function makeTopBtn(s: number): React.CSSProperties { return {
  width: 36 * s, height: 36 * s, borderRadius: 8,
  background: "rgba(0,0,0,0.55)", border: "2px solid rgba(255,255,255,0.4)",
  color: "#fff", fontSize: 14 * s, fontWeight: "bold",
  display: "flex", alignItems: "center", justifyContent: "center",
  userSelect: "none", touchAction: "none", cursor: "pointer",
}; }

function Btn({
  label,
  onDown,
  onUp,
  style,
  size = 64,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  style?: React.CSSProperties;
  size?: number;
}) {
  return (
    <button
      onTouchStart={(e) => { e.preventDefault(); onDown(); }}
      onTouchEnd={(e) => { e.preventDefault(); onUp(); }}
      onMouseDown={onDown}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: "rgba(255,255,255,0.15)",
        border: "3px solid rgba(255,255,255,0.4)",
        color: "white",
        fontSize: Math.round(size * 0.4),
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        touchAction: "none",
        cursor: "pointer",
        backdropFilter: "blur(4px)",
        ...style,
      }}
    >
      {label}
    </button>
  );
}

export default function MobileControls() {
  const screen = useGameStore((s) => s.screen);
  const isMobile =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  // Show in single-player AND multiplayer/practice on touch devices.
  const showOn = screen === "playing" || screen === "practice" || screen === "multiplayer";
  // Auto-shrink UI on small phones (the user asked: smaller UI on mobile = looks better).
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 800);
  useEffect(() => {
    const r = () => setVw(window.innerWidth);
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);
  const small = vw < 480;
  const s = small ? 0.78 : 1;
  const topBtn = makeTopBtn(s);
  const moveSize = Math.round(60 * s);
  const dashSize = Math.round(54 * s);
  const jumpSize = Math.round(68 * s);
  if (!isMobile || !showOn) return null;

  return (
    <>
      <div style={{ position: "fixed", top: 10, right: small ? 62 : 10, zIndex: 40, display: "flex", gap: 5 }}>
        <button
          onTouchStart={(e) => { e.preventDefault(); mobileInput.restartPressed = true; }}
          onMouseDown={() => { mobileInput.restartPressed = true; }}
          style={topBtn}
        >↻</button>
        <button
          onTouchStart={(e) => { e.preventDefault(); mobileInput.fullscreenPressed = true; }}
          onMouseDown={() => { mobileInput.fullscreenPressed = true; }}
          style={topBtn}
        >⛶</button>
      <button
        onTouchStart={(e) => { e.preventDefault(); mobileInput.pausePressed = true; }}
        onMouseDown={() => { mobileInput.pausePressed = true; }}
        style={topBtn}
      >❚❚</button>
      </div>
    <div
      style={{
        position: "fixed",
        bottom: small ? 12 : 20,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "space-between",
        padding: small ? "0 10px" : "0 20px",
        pointerEvents: "none",
        zIndex: 30,
      }}
    >
      {/* Left / Right */}
      <div style={{ display: "flex", gap: small ? 8 : 12, pointerEvents: "auto" }}>
        <Btn
          label="◀"
          size={moveSize}
          onDown={() => { mobileInput.left = true; }}
          onUp={() => { mobileInput.left = false; }}
        />
        <Btn
          label="▶"
          size={moveSize}
          onDown={() => { mobileInput.right = true; }}
          onUp={() => { mobileInput.right = false; }}
        />
      </div>

      {/* Jump */}
      <div style={{ pointerEvents: "auto", display: "flex", gap: small ? 6 : 10, alignItems: "flex-end" }}>
        <Btn
          label="⚡"
          size={dashSize}
          onDown={() => { mobileInput.dashPressed = true; }}
          onUp={() => {}}
          style={{
            background: "rgba(80,180,255,0.25)",
            border: "3px solid rgba(120,210,255,0.6)",
          }}
        />
        <Btn
          label="↑"
          size={jumpSize}
          onDown={() => { mobileInput.jump = true; mobileInput.jumpPressed = true; }}
          onUp={() => { mobileInput.jump = false; }}
          style={{
            background: "rgba(100,200,100,0.25)",
            border: "3px solid rgba(100,255,100,0.6)",
          }}
        />
      </div>
    </div>
    </>
  );
}
