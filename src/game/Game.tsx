import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore";
import {
  generateLevel, resetLevelState, LevelData, Platform, Spike, Troll,
  TILE, LEVEL_H, BASE_W, BASE_H, GROUND_Y, TROLL_W, TROLL_H,
} from "./levelGenerator";
import { mobileInput } from "../ui/MobileControls";
import { sounds } from "./sounds";
import { TOTAL_LEVELS } from "./gameConfig";

const GRAVITY = 0.31;
const JUMP_VY = -7.25;
const MOVE_SPEED = 2.6;
const PLAYER_W = 14;
const PLAYER_H = 18;
const MAX_FALL = 10;
const COYOTE_MS = 110;
const BUFFER_MS = 140;
const DASH_MS = 160;
const DASH_SPEED = 6.2;
const DASH_COOLDOWN_MS = 650;
const MAX_JUMPS = 2;

interface Player {
  x: number; y: number;
  vx: number; vy: number;
  onGround: boolean;
  dead: boolean;
  deathTimer: number;
  facingRight: boolean;
  walkTimer: number;
  jumpsLeft: number;
  coyote: number;
  buffer: number;
  dashTimer: number;
  dashCooldown: number;
  dashDir: number;
}

interface Keys {
  left: boolean; right: boolean;
  jumpJustPressed: boolean;
  dashJustPressed: boolean;
}

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

// ── Drawing helpers ───────────────────────────────────────────────────────

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function drawBg(ctx: CanvasRenderingContext2D, bg: string, camX: number) {
  px(ctx, 0, 0, BASE_W, BASE_H, bg);
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  for (let i = 0; i < 48; i++) {
    const sx = ((i * 137 + 11) % BASE_W + BASE_W) % BASE_W;
    const sy = (i * 97 + 7) % (BASE_H - 50);
    const dx = ((sx - Math.round(camX * 0.25)) % BASE_W + BASE_W) % BASE_W;
    ctx.fillRect(dx, sy, 1, 1);
  }
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let gy = TILE; gy < BASE_H; gy += TILE) ctx.fillRect(0, gy, BASE_W, 1);
}

function drawPlat(ctx: CanvasRenderingContext2D, plat: Platform, col: string, dark: string) {
  if (plat.gone) return;
  ctx.globalAlpha = plat.alpha;
  if (plat.disappearing && Math.floor(Date.now() / 70) % 2 === 0) ctx.globalAlpha *= 0.25;
  const { x, y, w, h } = plat;
  px(ctx, x, y, w, h, col);
  px(ctx, x, y, w, 2, "rgba(255,255,255,0.2)");
  px(ctx, x, y + h - 2, w, 2, dark);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  for (let bx = TILE; bx < w; bx += TILE) ctx.fillRect(Math.round(x + bx), Math.round(y), 1, h);
  ctx.globalAlpha = 1;
}

function drawSpike(ctx: CanvasRenderingContext2D, s: Spike) {
  const showHint = s.type === "popup" && s.revealed && !s.active;
  const showSpike = s.active || (s.type === "popup" && s.revealed && s.revealAnim > 0.01);

  if (showHint) {
    const pulse = (Math.sin(Date.now() / 110) + 1) / 2;
    const a = Math.min(0.9, s.revealAnim) * (0.45 + pulse * 0.55);
    ctx.fillStyle = `rgba(255,50,0,${a})`;
    const hy = s.dir === "down" ? s.y + s.h : s.y + s.h;
    ctx.fillRect(Math.round(s.x + s.w / 2 - 3), Math.round(hy), 6, 2);
  }
  if (!showSpike) return;

  ctx.globalAlpha = s.type === "popup" ? Math.min(1, s.revealAnim * 2.5) : 1;
  ctx.shadowColor = "#ff2200";
  ctx.shadowBlur = s.active ? 5 : 2;
  ctx.fillStyle = "#ff1100";

  const cx = Math.round(s.x + s.w / 2);
  ctx.beginPath();
  if (s.dir === "up") {
    ctx.moveTo(cx, Math.round(s.y));
    ctx.lineTo(Math.round(s.x + s.w), Math.round(s.y + s.h));
    ctx.lineTo(Math.round(s.x), Math.round(s.y + s.h));
  } else if (s.dir === "down") {
    ctx.moveTo(cx, Math.round(s.y + s.h));
    ctx.lineTo(Math.round(s.x), Math.round(s.y));
    ctx.lineTo(Math.round(s.x + s.w), Math.round(s.y));
  } else if (s.dir === "left") {
    ctx.moveTo(Math.round(s.x), Math.round(s.y + s.h / 2));
    ctx.lineTo(Math.round(s.x + s.w), Math.round(s.y));
    ctx.lineTo(Math.round(s.x + s.w), Math.round(s.y + s.h));
  } else {
    ctx.moveTo(Math.round(s.x + s.w), Math.round(s.y + s.h / 2));
    ctx.lineTo(Math.round(s.x), Math.round(s.y));
    ctx.lineTo(Math.round(s.x), Math.round(s.y + s.h));
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#770000";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawDoor(ctx: CanvasRenderingContext2D, door: LevelData["door"], won: boolean) {
  const { x, y, w, h } = door;
  if (won) { ctx.shadowColor = "#ffee00"; ctx.shadowBlur = 14; }
  px(ctx, x - 2, y - 2, w + 4, h + 2, "#553300");
  px(ctx, x, y, w, h, "#bb7700");
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#ffcc00");
  px(ctx, x + 2, y + 3, w - 4, 2, "rgba(255,255,255,0.35)");
  px(ctx, x + w - 4, y + Math.round(h * 0.45), 3, 4, "#553300");
  ctx.fillStyle = won ? "#ffee00" : "#ffcc00";
  ctx.beginPath();
  ctx.arc(Math.round(x + w / 2), y, Math.round(w / 2), Math.PI, 0);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// Faceless player — pure solid colored block with outline + highlight only
function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, accent: string) {
  if (p.dead && Math.floor(p.deathTimer / 70) % 2 === 0) return;
  const { x, y } = p;
  const W = PLAYER_W, H = PLAYER_H;
  const isJump = !p.onGround && p.vy < 0;
  const isFall = !p.onGround && p.vy > 0;

  ctx.save();
  if (!p.facingRight) {
    ctx.translate(x + W, y); ctx.scale(-1, 1); ctx.translate(-x, -y);
  }

  // Ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(Math.round(x + 1), Math.round(y + H), W - 2, 3);

  // Squash/stretch
  const sy = isJump ? 1.1 : isFall ? 1.07 : 1;
  const sx = isJump ? 0.92 : isFall ? 0.93 : 1;
  ctx.save();
  ctx.translate(Math.round(x + W / 2), Math.round(y + H));
  ctx.scale(sx, sy);
  ctx.translate(-Math.round(W / 2), -H);

  // Body — solid accent color, no face
  px(ctx, 0, 0, W, H, accent);

  // 1px dark outline
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, W, 1);
  ctx.fillRect(0, H - 1, W, 1);
  ctx.fillRect(0, 0, 1, H);
  ctx.fillRect(W - 1, 0, 1, H);

  // Top highlight bar
  px(ctx, 1, 1, W - 2, 2, "rgba(255,255,255,0.28)");
  // Bottom dark bar
  px(ctx, 1, H - 3, W - 2, 2, "rgba(0,0,0,0.25)");

  ctx.restore();
  ctx.restore();
}

// Troll enemy — darker, chunkier block, also faceless, with small horns on top
function drawTroll(ctx: CanvasRenderingContext2D, t: Troll, now: number) {
  const { x, y } = t;
  const W = TROLL_W, H = TROLL_H;
  const bob = Math.sin(now / 200) * 1;

  // Horns (2 small red spikes on top)
  ctx.fillStyle = "#cc0000";
  ctx.beginPath();
  ctx.moveTo(Math.round(x + 3), Math.round(y + bob));
  ctx.lineTo(Math.round(x + 6), Math.round(y + bob + 5));
  ctx.lineTo(Math.round(x), Math.round(y + bob + 5));
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(Math.round(x + W - 3), Math.round(y + bob));
  ctx.lineTo(Math.round(x + W), Math.round(y + bob + 5));
  ctx.lineTo(Math.round(x + W - 6), Math.round(y + bob + 5));
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.shadowColor = "#cc0000";
  ctx.shadowBlur = 4;
  px(ctx, x, y + bob + 3, W, H - 3, "#882200");
  ctx.shadowBlur = 0;

  // Outline
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(Math.round(x), Math.round(y + bob + 3), W, 1);
  ctx.fillRect(Math.round(x), Math.round(y + bob + H - 1), W, 1);
  ctx.fillRect(Math.round(x), Math.round(y + bob + 3), 1, H - 3);
  ctx.fillRect(Math.round(x + W - 1), Math.round(y + bob + 3), 1, H - 3);

  // Highlight
  px(ctx, x + 1, y + bob + 4, W - 2, 2, "rgba(255,120,80,0.3)");
}

// ── Fullscreen helper ─────────────────────────────────────────────────────

function toggleFS() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.({ navigationUI: "hide" })?.catch(() => {
    document.documentElement.requestFullscreen?.();
  });
}

// ── Main component ────────────────────────────────────────────────────────

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const setScreen = useGameStore((s) => s.setScreen);
  const completeLevel = useGameStore((s) => s.completeLevel);
  const addDeath = useGameStore((s) => s.addDeath);
  const startLevel = useGameStore((s) => s.startLevel);

  const levelRef = useRef<LevelData>(generateLevel(currentLevel));
  const playerRef = useRef<Player>({
    x: 0, y: 0, vx: 0, vy: 0,
    onGround: false, dead: false, deathTimer: 0,
    facingRight: true, walkTimer: 0,
  });
  const keysRef = useRef<Keys>({ left: false, right: false, jumpJustPressed: false });
  const camXRef = useRef(0);
  const winTimerRef = useRef(-1);
  const levelNumRef = useRef(currentLevel);
  const storeRef = useRef({ completeLevel, addDeath, setScreen, startLevel });
  useEffect(() => { storeRef.current = { completeLevel, addDeath, setScreen, startLevel }; });

  function respawn() {
    const lv = levelRef.current;
    resetLevelState(lv);
    const p = playerRef.current;
    p.x = lv.playerStart.x; p.y = lv.playerStart.y;
    p.vx = 0; p.vy = 0; p.onGround = false;
    p.dead = false; p.deathTimer = 0;
    camXRef.current = 0; winTimerRef.current = -1;
  }

  useEffect(() => {
    levelNumRef.current = currentLevel;
    levelRef.current = generateLevel(currentLevel);
    respawn();
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

  // Keyboard
  useEffect(() => {
    const k = keysRef.current;
    const dn = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") k.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") k.right = true;
      if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") && !e.repeat)
        k.jumpJustPressed = true;
      if (e.code === "KeyF") toggleFS();
      if (e.code === "Escape") storeRef.current.setScreen("levelselect");
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") k.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") k.right = false;
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  // Game loop
  useEffect(() => {
    let animId: number;
    const FDT = 1000 / 60;

    function update() {
      const lv = levelRef.current;
      const p = playerRef.current;
      const k = keysRef.current;
      const mob = mobileInput;
      const now = Date.now();

      // Win: auto-advance to next level
      if (winTimerRef.current >= 0) {
        winTimerRef.current += FDT;
        if (winTimerRef.current > 1000) {
          storeRef.current.completeLevel();
          sounds.levelComplete();
          const next = levelNumRef.current + 1;
          if (next <= TOTAL_LEVELS) {
            storeRef.current.startLevel(next);
          } else {
            storeRef.current.setScreen("levelselect");
          }
        }
        return;
      }

      if (p.dead) {
        p.deathTimer += FDT;
        if (p.deathTimer > 750) {
          storeRef.current.addDeath(levelNumRef.current);
          respawn();
        }
        return;
      }

      const goL = k.left || mob.left;
      const goR = k.right || mob.right;
      const jump = k.jumpJustPressed || mob.jumpPressed;
      k.jumpJustPressed = false;
      mob.jumpPressed = false;

      p.vx = 0;
      if (goL) { p.vx = -MOVE_SPEED; p.facingRight = false; }
      if (goR) { p.vx = MOVE_SPEED; p.facingRight = true; }
      if (goL && goR) p.vx = 0;

      if (jump && p.onGround) { p.vy = JUMP_VY; p.onGround = false; sounds.jump(); }
      p.vy = Math.min(p.vy + GRAVITY, MAX_FALL);

      p.x += p.vx;
      p.x = Math.max(0, Math.min(p.x, lv.widthPx - PLAYER_W));
      p.onGround = false;
      for (const plat of lv.platforms) resolveX(p, plat);

      p.y += p.vy;
      for (const plat of lv.platforms) {
        const landed = resolveY(p, plat);
        if (landed && plat.type === "disappear" && !plat.disappearing) {
          plat.standTimer += FDT;
          if (plat.standTimer > 300) plat.disappearing = true;
        }
        if (!landed && plat.type === "disappear" && !plat.disappearing) {
          plat.standTimer = Math.max(0, plat.standTimer - FDT * 2);
        }
      }

      // Update platforms
      for (const plat of lv.platforms) {
        if (plat.disappearing) { plat.alpha -= 0.025; if (plat.alpha <= 0) { plat.alpha = 0; plat.gone = true; } }
        if (plat.type === "moving" && !plat.gone) { plat.t += plat.moveSpeed; plat.x = plat.baseX + Math.sin(plat.t) * plat.moveRange; }
      }

      // Update spikes
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

      // Update trolls
      for (const tr of lv.trolls) {
        tr.x += tr.vx;
        tr.walkTimer += Math.abs(tr.vx);
        if (tr.x <= tr.patrolLeft) { tr.x = tr.patrolLeft; tr.vx = Math.abs(tr.vx); }
        if (tr.x >= tr.patrolRight) { tr.x = tr.patrolRight; tr.vx = -Math.abs(tr.vx); }
        // Troll kills player
        if (!p.dead && rectOverlap(p.x + 2, p.y + 2, PLAYER_W - 4, PLAYER_H - 4, tr.x, tr.y, TROLL_W, TROLL_H)) {
          sounds.troll(); p.dead = true; p.deathTimer = 0;
        }
      }

      // Fallen off
      if (p.y > LEVEL_H + TILE * 2) { sounds.die(); p.dead = true; p.deathTimer = 0; return; }

      // Spike death
      for (const sp of lv.spikes) {
        if (!sp.active) continue;
        if (rectOverlap(p.x + 3, p.y + 3, PLAYER_W - 6, PLAYER_H - 5, sp.x, sp.y, sp.w, sp.h)) {
          sounds.spike(); p.dead = true; p.deathTimer = 0; return;
        }
      }

      // Door = win
      const d = lv.door;
      if (winTimerRef.current < 0 && rectOverlap(p.x, p.y, PLAYER_W, PLAYER_H, d.x, d.y, d.w, d.h)) {
        winTimerRef.current = 0; sounds.door();
      }

      // Camera
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

      drawBg(ctx, lv.bgColor, camX);
      px(ctx, Math.round(camX), LEVEL_H, BASE_W, BASE_H, "rgba(0,0,0,0.75)");

      for (const plat of lv.platforms) drawPlat(ctx, plat, lv.platformColor, lv.platformDark);
      drawDoor(ctx, lv.door, winTimerRef.current >= 0);
      for (const sp of lv.spikes) drawSpike(ctx, sp);
      for (const tr of lv.trolls) drawTroll(ctx, tr, now);
      drawPlayer(ctx, p, lv.accentColor);

      // Win overlay
      if (winTimerRef.current >= 0) {
        const a = Math.min(0.6, winTimerRef.current / 1000 * 0.6);
        ctx.fillStyle = `rgba(255,220,50,${a})`;
        ctx.fillRect(Math.round(camX), 0, BASE_W, BASE_H);
      }

      ctx.restore();

      // ── HUD ──────────────────────────────────────────────────
      px(ctx, 0, 0, BASE_W, 13, "rgba(0,0,0,0.75)");
      ctx.font = "bold 8px 'Courier New', monospace";
      ctx.textBaseline = "middle";
      ctx.imageSmoothingEnabled = false;

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(`LEVEL  ${lv.num}`, BASE_W / 2, 6.5);

      const prog = Math.max(0, Math.min(1, p.x / Math.max(1, lv.widthPx - PLAYER_W)));
      px(ctx, BASE_W * 0.28, 9, BASE_W * 0.44, 3, "rgba(255,255,255,0.12)");
      px(ctx, BASE_W * 0.28, 9, BASE_W * 0.44 * prog, 3, lv.accentColor);

      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "left";
      ctx.fillText("ESC=EXIT", 3, 6.5);
      ctx.textAlign = "right";
      ctx.fillText("F=FULL", BASE_W - 3, 6.5);

      // Win banner
      if (winTimerRef.current >= 0) {
        const nextN = lv.num + 1;
        px(ctx, BASE_W / 2 - 70, BASE_H / 2 - 14, 140, 28, "rgba(0,0,0,0.85)");
        ctx.fillStyle = "#ffee22";
        ctx.textAlign = "center";
        ctx.font = "bold 9px 'Courier New', monospace";
        ctx.fillText("LEVEL COMPLETE!", BASE_W / 2, BASE_H / 2 - 5);
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 7px 'Courier New', monospace";
        ctx.fillText(nextN <= TOTAL_LEVELS ? `→ LEVEL ${nextN}` : "YOU WIN!", BASE_W / 2, BASE_H / 2 + 7);
        // Countdown bar
        const pct = Math.min(1, winTimerRef.current / 1000);
        px(ctx, BASE_W / 2 - 60, BASE_H / 2 + 14, 120, 3, "rgba(255,255,255,0.1)");
        px(ctx, BASE_W / 2 - 60, BASE_H / 2 + 14, 120 * pct, 3, "#ffee22");
      }
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
  }, [currentLevel]);

  return (
    <div style={{
      width: "100vw", height: "100vh", background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    }}>
      <canvas ref={canvasRef} width={BASE_W} height={BASE_H}
        style={{ display: "block", imageRendering: "pixelated" }} />

      {/* Exit button — top-left overlay */}
      <button
        onClick={() => setScreen("levelselect")}
        style={{
          position: "fixed", top: 10, left: 10, zIndex: 50,
          background: "rgba(180,40,40,0.85)", border: "2px solid rgba(255,80,80,0.5)",
          color: "#fff", fontFamily: "'Courier New', monospace",
          fontWeight: "bold", fontSize: 11, padding: "4px 10px",
          cursor: "pointer", borderRadius: 0, letterSpacing: "0.08em",
          textShadow: "1px 1px 0 rgba(0,0,0,0.6)",
        }}
      >
        ✕ EXIT
      </button>

      {/* Fullscreen button — bottom-right */}
      <button
        onClick={toggleFS}
        title="Fullscreen (F)"
        style={{
          position: "fixed", bottom: 10, right: 10, zIndex: 50,
          background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)",
          color: "rgba(255,255,255,0.45)", fontSize: 13, width: 26, height: 26,
          cursor: "pointer", borderRadius: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >⛶</button>
    </div>
  );
}
