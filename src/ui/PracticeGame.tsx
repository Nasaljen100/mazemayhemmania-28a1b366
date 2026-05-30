import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/gameStore";
import {
  generateLevel, resetLevelState, LevelData, Platform, Spike, Troll,
  TILE, LEVEL_H, BASE_W, BASE_H, GROUND_Y, TROLL_W, TROLL_H,
} from "../game/levelGenerator";
import { mobileInput } from "./MobileControls";

const GRAVITY = 0.31;
const JUMP_VY = -7.25;
const MOVE_SPEED = 2.6;
const PLAYER_W = 14;
const PLAYER_H = 18;
const MAX_FALL = 10;

interface Player {
  x: number; y: number;
  vx: number; vy: number;
  onGround: boolean;
  dead: boolean;
  deathTimer: number;
  facingRight: boolean;
}

interface Checkpoint {
  x: number;
  y: number;
}

interface Keys { left: boolean; right: boolean; jumpJustPressed: boolean; }

function rectOverlap(ax: number, ay: number, aw: number, ah: number,
                     bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function resolveX(p: Player, plat: Platform) {
  if (plat.gone) return;
  if (!rectOverlap(p.x, p.y, PLAYER_W, PLAYER_H, plat.x, plat.y, plat.w, plat.h)) return;
  const oL = (p.x + PLAYER_W) - plat.x;
  const oR = (plat.x + plat.w) - p.x;
  if (oL < oR) { p.x = plat.x - PLAYER_W; p.vx = 0; }
  else { p.x = plat.x + plat.w; p.vx = 0; }
}

function resolveY(p: Player, plat: Platform): boolean {
  if (plat.gone) return false;
  if (!rectOverlap(p.x, p.y, PLAYER_W, PLAYER_H, plat.x, plat.y, plat.w, plat.h)) return false;
  const oT = (p.y + PLAYER_H) - plat.y;
  const oB = (plat.y + plat.h) - p.y;
  if (oT < oB && p.vy >= 0) { p.y = plat.y - PLAYER_H; p.vy = 0; p.onGround = true; return true; }
  else if (oB <= oT && p.vy < 0) { p.y = plat.y + plat.h; p.vy = 0; }
  return false;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

export default function PracticeGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentLevel = useGameStore((s) => s.currentLevel);

  const levelRef = useRef<LevelData>(generateLevel(currentLevel));
  const playerRef = useRef<Player>({
    x: 0, y: 0, vx: 0, vy: 0,
    onGround: false, dead: false, deathTimer: 0, facingRight: true,
  });
  const keysRef = useRef<Keys>({ left: false, right: false, jumpJustPressed: false });
  const camXRef = useRef(0);
  const checkpointsRef = useRef<Checkpoint[]>([]);
  const [mode, setMode] = useState<"play" | "placeCheckpoint" | "deleteCheckpoint">("play");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [, forceRender] = useState(0);

  function spawnAt(cp?: Checkpoint) {
    const lv = levelRef.current;
    const p = playerRef.current;
    const start = cp ?? lv.playerStart;
    p.x = start.x; p.y = start.y;
    p.vx = 0; p.vy = 0; p.dead = false; p.deathTimer = 0;
  }

  useEffect(() => {
    levelRef.current = generateLevel(currentLevel);
    resetLevelState(levelRef.current);
    checkpointsRef.current = [];
    spawnAt();
    camXRef.current = 0;
  }, [currentLevel]);

  // Scale canvas
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      const scale = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
      c.style.width = `${Math.round(BASE_W * scale)}px`;
      c.style.height = `${Math.round(BASE_H * scale)}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Canvas click — place/delete checkpoint
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = BASE_W / rect.width;
      const scaleY = BASE_H / rect.height;
      const cx = (e.clientX - rect.left) * scaleX + camXRef.current;
      const cy = (e.clientY - rect.top) * scaleY;

      if (modeRef.current === "placeCheckpoint") {
        checkpointsRef.current = [...checkpointsRef.current, { x: cx - PLAYER_W / 2, y: cy - PLAYER_H }];
        forceRender(n => n + 1);
      } else if (modeRef.current === "deleteCheckpoint") {
        const RADIUS = TILE;
        checkpointsRef.current = checkpointsRef.current.filter(c =>
          Math.hypot(c.x - cx, c.y - cy) > RADIUS
        );
        forceRender(n => n + 1);
      }
    };
    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, []);

  // Keyboard
  useEffect(() => {
    const k = keysRef.current;
    const dn = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") k.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") k.right = true;
      if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") && !e.repeat)
        k.jumpJustPressed = true;
      if (e.code === "Escape") onExit();
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") k.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") k.right = false;
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, [onExit]);

  // Game loop
  useEffect(() => {
    let animId: number;
    const FDT = 1000 / 60;

    function update() {
      const lv = levelRef.current;
      const p = playerRef.current;
      const k = keysRef.current;
      const mob = mobileInput;

      if (p.dead) {
        p.deathTimer += FDT;
        if (p.deathTimer > 600) {
          // Respawn at last checkpoint
          const cps = checkpointsRef.current;
          const last = cps.length > 0 ? cps[cps.length - 1] : undefined;
          resetLevelState(lv);
          spawnAt(last);
        }
        return;
      }

      if (modeRef.current !== "play") return;

      const goL = k.left || mob.left;
      const goR = k.right || mob.right;
      const jump = k.jumpJustPressed || mob.jumpPressed;
      k.jumpJustPressed = false;
      mob.jumpPressed = false;

      p.vx = 0;
      if (goL) { p.vx = -MOVE_SPEED; p.facingRight = false; }
      if (goR) { p.vx = MOVE_SPEED; p.facingRight = true; }
      if (goL && goR) p.vx = 0;

      if (jump && p.onGround) { p.vy = JUMP_VY; p.onGround = false; }
      p.vy = Math.min(p.vy + GRAVITY, MAX_FALL);

      p.x += p.vx;
      p.x = Math.max(0, Math.min(p.x, lv.widthPx - PLAYER_W));
      p.onGround = false;
      for (const plat of lv.platforms) resolveX(p, plat);

      p.y += p.vy;
      for (const plat of lv.platforms) resolveY(p, plat);

      for (const plat of lv.platforms) {
        if (plat.type === "moving" && !plat.gone) { plat.t += plat.moveSpeed; plat.x = plat.baseX + Math.sin(plat.t) * plat.moveRange; }
      }

      for (const sp of lv.spikes) {
        if (sp.type === "popup" && !sp.revealed && p.x + PLAYER_W > sp.triggerMinX && p.x < sp.triggerMaxX)
          sp.revealed = true;
        if (sp.type === "popup" && sp.revealed) {
          sp.revealTimer += FDT;
          sp.revealAnim = Math.min(1, sp.revealTimer / sp.popupDelay);
          if (sp.revealTimer >= sp.popupDelay) sp.active = true;
        }
        if (sp.type === "moving") { sp.t += sp.moveSpeed; sp.x = sp.baseX + Math.sin(sp.t) * sp.moveRange; }
      }

      for (const tr of lv.trolls) {
        tr.x += tr.vx;
        if (tr.x <= tr.patrolLeft) { tr.x = tr.patrolLeft; tr.vx = Math.abs(tr.vx); }
        if (tr.x >= tr.patrolRight) { tr.x = tr.patrolRight; tr.vx = -Math.abs(tr.vx); }
        if (rectOverlap(p.x + 2, p.y + 2, PLAYER_W - 4, PLAYER_H - 4, tr.x, tr.y, TROLL_W, TROLL_H)) {
          p.dead = true; p.deathTimer = 0;
        }
      }

      if (p.y > LEVEL_H + TILE * 2) { p.dead = true; p.deathTimer = 0; return; }

      for (const sp of lv.spikes) {
        if (!sp.active) continue;
        if (rectOverlap(p.x + 3, p.y + 3, PLAYER_W - 6, PLAYER_H - 5, sp.x, sp.y, sp.w, sp.h)) {
          p.dead = true; p.deathTimer = 0; return;
        }
      }

      camXRef.current = Math.max(0, Math.min(p.x - BASE_W / 2 + PLAYER_W / 2, lv.widthPx - BASE_W));
    }

    function render(ctx: CanvasRenderingContext2D) {
      const lv = levelRef.current;
      const p = playerRef.current;
      const camX = camXRef.current;
      const now = Date.now();

      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(-Math.round(camX), 0);

      // Background
      ctx.fillStyle = lv.bgColor;
      ctx.fillRect(0, 0, lv.widthPx, BASE_H);
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(Math.round(camX), LEVEL_H, BASE_W, BASE_H);

      // Platforms
      for (const plat of lv.platforms) {
        if (plat.gone) continue;
        ctx.globalAlpha = plat.alpha;
        if (plat.disappearing && Math.floor(now / 70) % 2 === 0) ctx.globalAlpha *= 0.25;
        px(ctx, plat.x, plat.y, plat.w, plat.h, lv.platformColor);
        px(ctx, plat.x, plat.y, plat.w, 2, "rgba(255,255,255,0.2)");
        px(ctx, plat.x, plat.y + plat.h - 2, plat.w, 2, lv.platformDark);
        ctx.globalAlpha = 1;
      }

      // Door
      const { x: dx, y: dy, w: dw, h: dh } = lv.door;
      px(ctx, dx - 2, dy - 2, dw + 4, dh + 2, "#553300");
      px(ctx, dx, dy, dw, dh, "#bb7700");
      px(ctx, dx + 1, dy + 1, dw - 2, dh - 2, "#ffcc00");

      // Spikes
      for (const sp of lv.spikes) {
        if (!sp.active) continue;
        ctx.fillStyle = "#ff1100";
        ctx.beginPath();
        const cx = Math.round(sp.x + sp.w / 2);
        if (sp.dir === "up") {
          ctx.moveTo(cx, Math.round(sp.y)); ctx.lineTo(Math.round(sp.x + sp.w), Math.round(sp.y + sp.h)); ctx.lineTo(Math.round(sp.x), Math.round(sp.y + sp.h));
        } else {
          ctx.moveTo(cx, Math.round(sp.y + sp.h)); ctx.lineTo(Math.round(sp.x), Math.round(sp.y)); ctx.lineTo(Math.round(sp.x + sp.w), Math.round(sp.y));
        }
        ctx.closePath(); ctx.fill();
      }

      // Trolls
      for (const tr of lv.trolls) {
        ctx.fillStyle = "#cc0000";
        ctx.beginPath();
        ctx.moveTo(Math.round(tr.x + 3), Math.round(tr.y)); ctx.lineTo(Math.round(tr.x + 6), Math.round(tr.y + 5)); ctx.lineTo(Math.round(tr.x), Math.round(tr.y + 5)); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(Math.round(tr.x + TROLL_W - 3), Math.round(tr.y)); ctx.lineTo(Math.round(tr.x + TROLL_W), Math.round(tr.y + 5)); ctx.lineTo(Math.round(tr.x + TROLL_W - 6), Math.round(tr.y + 5)); ctx.closePath(); ctx.fill();
        px(ctx, tr.x, tr.y + 3, TROLL_W, TROLL_H - 3, "#882200");
      }

      // Checkpoints — green flags
      for (const cp of checkpointsRef.current) {
        ctx.fillStyle = "#00ff88";
        ctx.fillRect(Math.round(cp.x + PLAYER_W / 2), Math.round(cp.y - 12), 2, 14);
        ctx.fillRect(Math.round(cp.x + PLAYER_W / 2 + 2), Math.round(cp.y - 12), 8, 6);
        ctx.fillStyle = "rgba(0,255,136,0.18)";
        ctx.fillRect(Math.round(cp.x), Math.round(cp.y), PLAYER_W, PLAYER_H);
      }

      // Player
      if (!(p.dead && Math.floor(p.deathTimer / 70) % 2 === 0)) {
        px(ctx, p.x, p.y, PLAYER_W, PLAYER_H, lv.accentColor);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(Math.round(p.x), Math.round(p.y), PLAYER_W, 1);
        ctx.fillRect(Math.round(p.x), Math.round(p.y + PLAYER_H - 1), PLAYER_W, 1);
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, PLAYER_H);
        ctx.fillRect(Math.round(p.x + PLAYER_W - 1), Math.round(p.y), 1, PLAYER_H);
        px(ctx, p.x + 1, p.y + 1, PLAYER_W - 2, 2, "rgba(255,255,255,0.28)");
      }

      ctx.restore();

      // HUD
      px(ctx, 0, 0, BASE_W, 13, "rgba(0,0,0,0.8)");
      ctx.font = "bold 8px 'Courier New', monospace";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffee22";
      ctx.textAlign = "center";
      ctx.fillText(`PRACTICE MODE · LEVEL ${lv.num}`, BASE_W / 2, 6.5);

      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "left";
      ctx.fillText(`CHECKPOINTS: ${checkpointsRef.current.length}`, 4, 6.5);
    }

    let lastTime = 0;
    function loop(t: number) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const delta = Math.min(t - lastTime, 50);
      lastTime = t;
      const steps = Math.min(3, Math.max(1, Math.round(delta / (1000 / 60))));
      for (let i = 0; i < steps; i++) update();
      ctx.clearRect(0, 0, BASE_W, BASE_H);
      render(ctx);
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div style={{
      width: "100vw", height: "100vh", background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
    }}>
      <canvas ref={canvasRef} width={BASE_W} height={BASE_H}
        style={{
          display: "block", imageRendering: "pixelated",
          cursor: mode !== "play" ? "crosshair" : "default",
        }}
      />

      {/* Practice toolbar */}
      <div style={{
        position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 8, zIndex: 50,
        background: "rgba(0,0,0,0.85)", border: "2px solid rgba(255,255,255,0.15)",
        padding: "8px 12px",
      }}>
        <PracticeBtn label="▶ PLAY" active={mode === "play"} onClick={() => setMode("play")} />
        <PracticeBtn label="📍 SPAWN CHECKPOINT" active={mode === "placeCheckpoint"} color="#00ff88"
          onClick={() => setMode(mode === "placeCheckpoint" ? "play" : "placeCheckpoint")} />
        <PracticeBtn label="🗑 DELETE CHECKPOINT" active={mode === "deleteCheckpoint"} color="#ff5544"
          onClick={() => setMode(mode === "deleteCheckpoint" ? "play" : "deleteCheckpoint")} />
        <PracticeBtn label="✕ EXIT PRACTICE" color="#cc2200" onClick={onExit} />
      </div>

      {/* Mode hint */}
      {mode !== "play" && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.85)", border: "2px solid #00ff88",
          color: "#00ff88", fontFamily: "'Courier New', monospace",
          fontSize: 11, padding: "6px 14px", zIndex: 50, letterSpacing: "0.1em",
        }}>
          {mode === "placeCheckpoint" ? "CLICK ON SCREEN TO PLACE CHECKPOINT" : "CLICK ON A CHECKPOINT TO DELETE IT"}
        </div>
      )}
    </div>
  );
}

function PracticeBtn({ label, active, color = "#aaa", onClick }: {
  label: string; active?: boolean; color?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px", background: active ? "rgba(255,255,255,0.15)" : "transparent",
      border: `2px solid ${active ? color : "rgba(255,255,255,0.2)"}`,
      color: active ? color : "rgba(255,255,255,0.6)",
      fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: "bold",
      cursor: "pointer", letterSpacing: "0.05em", whiteSpace: "nowrap",
    }}>
      {label}
    </button>
  );
}
