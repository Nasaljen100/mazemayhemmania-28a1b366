import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore";

export interface MobileInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
}

export const mobileInput: MobileInput = { left: false, right: false, jump: false, jumpPressed: false };

function Btn({
  label,
  onDown,
  onUp,
  style,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onTouchStart={(e) => { e.preventDefault(); onDown(); }}
      onTouchEnd={(e) => { e.preventDefault(); onUp(); }}
      onMouseDown={onDown}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      style={{
        width: 72,
        height: 72,
        borderRadius: 12,
        background: "rgba(255,255,255,0.15)",
        border: "3px solid rgba(255,255,255,0.4)",
        color: "white",
        fontSize: 28,
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
  const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  if (!isMobile || screen !== "playing") return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "space-between",
        padding: "0 20px",
        pointerEvents: "none",
        zIndex: 30,
      }}
    >
      {/* Left / Right */}
      <div style={{ display: "flex", gap: 12, pointerEvents: "auto" }}>
        <Btn
          label="◀"
          onDown={() => { mobileInput.left = true; }}
          onUp={() => { mobileInput.left = false; }}
        />
        <Btn
          label="▶"
          onDown={() => { mobileInput.right = true; }}
          onUp={() => { mobileInput.right = false; }}
        />
      </div>

      {/* Jump */}
      <div style={{ pointerEvents: "auto" }}>
        <Btn
          label="↑"
          onDown={() => { mobileInput.jump = true; mobileInput.jumpPressed = true; }}
          onUp={() => { mobileInput.jump = false; }}
          style={{
            width: 80,
            height: 80,
            background: "rgba(100,200,100,0.25)",
            border: "3px solid rgba(100,255,100,0.6)",
          }}
        />
      </div>
    </div>
  );
}
