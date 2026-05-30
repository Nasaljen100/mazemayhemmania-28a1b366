import { useEffect, useRef } from "react";
import { useMultiplayerStore } from "../store/multiplayerStore";
import { useAccountStore } from "../store/accountStore";
import { useGameStore } from "../store/gameStore";
import {
  generateLevel, resetLevelState, LevelData, Platform, Spike, Troll,
  TILE, LEVEL_H, BASE_W, BASE_H, GROUND_Y, TROLL_W, TROLL_H,
} from "../game/levelGenerator";
import { mobileInput } from "./MobileControls";
import { sounds } from "../game/sounds";
import { PLAYER_COLORS, TOTAL_LEVELS } from "../game/gameConfig";

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
  walkTimer: number;
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
}

function drawPlat(ctx: CanvasRenderingContext2D, plat: Platform, col: string, dark: string) {
  if (plat.gone) return;
  ctx.globalAlpha = plat.alpha;
  if (plat.disappearing && Math.floor(Date.now() / 70) % 2 === 0) ctx.globalAlpha *= 0.25;
  const { x, y, w, h } = plat;
  px(ctx, x, y, w, h, col);
  px(ctx, x, y, w, 2, "rgba(255,255,255,0.2)");
  px(ctx, x, y + h - 2, w, 2, dark);
  ctx.globalAlpha = 1;
}

function drawSpike(ctx: CanvasRenderingContext2D, sp: Spike) {
  if (!sp.active) return;
  const { x, y, w, h } = sp;
  const revealY = sp.type === "popup" ? y + h * (1 - sp.revealAnim) : y;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, revealY, w, h);
  ctx.clip();
  const count = Math.max(1, Math.floor(w / 8));
  const sw = w / count;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = "#cc2222";
    ctx.beginPath();
    ctx.moveTo(x + i * sw, y + h);
    ctx.lineTo(x + i * sw + sw / 2, y);
    ctx.lineTo(x + i * sw + sw, y + h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,100,100,0.4)";
    ctx.beginPath();
    ctx.moveTo(x + i * sw, y + h);
    ctx.lineTo(x + i * sw + sw * 0.35, y + h * 0.3);
    ctx.lineTo(x + i * sw + sw * 0.5, y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawTroll(ctx: CanvasRenderingContext2D, tr: Troll, now: number) {
  const { x, y } = tr;
  const blink = Math.floor(now / 350) % 4 === 0;
  px(ctx, x, y + 4, TROLL_W, TROLL_H - 4, "#228822");
  px(ctx, x + 2, y, TROLL_W - 4, 10, "#339933");
  if (!blink) {
    px(ctx, x + 3, y + 3, 3, 3, "#ffffff");
    px(ctx, x + TROLL_W - 6, y + 3, 3, 3, "#ffffff");
    px(ctx, x + 4, y + 4, 2, 2, "#ff3300");
    px(ctx, x + TROLL_W - 6, y + 4, 2, 2, "#ff3300");
  }
  px(ctx, x + 3, y + 8, TROLL_W - 6, 2, "#cc0000");
  for (let i = 0; i < 3; i++) px(ctx, x + 5 + i * 3, y + 8, 1, 2, "#ffcc00");
  const walkFrame = Math.floor(now / 180) % 2;
  if (walkFrame === 0) { px(ctx, x + 2, y + TROLL_H - 4, 4, 4, "#228822"); px(ctx, x + TROLL_W - 6, y + TROLL_H - 2, 4, 2, "#228822"); }
  else { px(ctx, x + 2, y + TROLL_H - 2, 4, 2, "#228822"); px(ctx, x + TROLL_W - 6, y + TROLL_H - 4, 4, 4, "#228822"); }
}

function drawDoor(ctx: CanvasRenderingContext2D, door: LevelData["door"], won: boolean) {
  const { x, y, w, h } = door;
  px(ctx, x, y, w, h, won ? "#ffee44" : "#553300");
  px(ctx, x + w / 2 - 2, y + h / 2 - 2, 4, 4, won ? "#fff" : "#ffcc44");
  px(ctx, x, y, w, 3, "#aa6600");
  if (!won) {
    const pulse = 0.3 + 0.3 * Math.sin(Date.now() / 400);
    ctx.fillStyle = `rgba(255,200,50,${pulse})`;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  }
}

function drawLocalPlayer(ctx: CanvasRenderingContext2D, p: Player, accent: string) {
  if (p.dead && Math.floor(p.deathTimer / 70) % 2 === 0) return;
  const isJump = !p.onGround && p.vy < 0;
  ctx.save();
  if (!p.facingRight) { ctx.translate(p.x + PLAYER_W, 0); ctx.scale(-1, 1); ctx.translate(-p.x, 0); }
  // Body
  px(ctx, p.x, p.y + 6, PLAYER_W, PLAYER_H - 6, accent);
  px(ctx, p.x + 1, p.y + 1, PLAYER_W - 2, 7, "#ffddbb");
  // Eyes
  px(ctx, p.x + 2, p.y + 2, 3, 3, "#fff");
  px(ctx, p.x + 8, p.y + 2, 3, 3, "#fff");
  px(ctx, p.x + 3, p.y + 3, 2, 2, "#222");
  px(ctx, p.x + 9, p.y + 3, 2, 2, "#222");
  if (isJump) { px(ctx, p.x + 3, p.y + 4, 8, 1, "#222"); }
  else { px(ctx, p.x + 3, p.y + 5, 2, 1, "#aa5555"); px(ctx, p.x + 8, p.y + 5, 2, 1, "#aa5555"); }
  // Legs
  const lf = Math.floor(Date.now() / 120) % 2;
  if (!p.onGround) { px(ctx, p.x + 1, p.y + PLAYER_H, 4, 4, accent); px(ctx, p.x + PLAYER_W - 5, p.y + PLAYER_H, 4, 4, accent); }
  else if (lf === 0) { px(ctx, p.x + 1, p.y + PLAYER_H - 2, 4, 6, accent); px(ctx, p.x + PLAYER_W - 5, p.y + PLAYER_H, 4, 4, accent); }
  else { px(ctx, p.x + 1, p.y + PLAYER_H, 4, 4, accent); px(ctx, p.x + PLAYER_W - 5, p.y + PLAYER_H - 2, 4, 6, accent); }
  ctx.restore();
}

function drawRemotePlayer(ctx: CanvasRenderingContext2D, rp: { x: number; y: number; facingRight: boolean; dead: boolean; username: string; colorIndex: number }) {
  if (rp.dead) return;
  const color = PLAYER_COLORS[rp.colorIndex] ?? "#22bbff";
  ctx.save();
  if (!rp.facingRight) { ctx.translate(rp.x + PLAYER_W, 0); ctx.scale(-1, 1); ctx.translate(-rp.x, 0); }
  // Ghost-like remote player
  ctx.globalAlpha = 0.8;
  px(ctx, rp.x, rp.y + 6, PLAYER_W, PLAYER_H - 6, color);
  px(ctx, rp.x + 1, rp.y + 1, PLAYER_W - 2, 7, "#cceeff");
  px(ctx, rp.x + 2, rp.y + 2, 3, 3, "#fff");
  px(ctx, rp.x + 8, rp.y + 2, 3, 3, "#fff");
  px(ctx, rp.x + 3, rp.y + 3, 2, 2, "#333");
  px(ctx, rp.x + 9, rp.y + 3, 2, 2, "#333");
  ctx.globalAlpha = 1;
  ctx.restore();

  // Name tag above head
  ctx.save();
  ctx.font = "bold 6px 'Courier New', monospace";
  ctx.textAlign = "center";
  const nameW = ctx.measureText(rp.username).width + 6;
  const nameX = rp.x + PLAYER_W / 2;
  const nameY = rp.y - 12;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(nameX - nameW / 2, nameY - 6, nameW, 10);
  ctx.fillStyle = color;
  ctx.fillText(rp.username, nameX, nameY);
  ctx.restore();
}

interface Props {
  lobbyId: string;
  startLevel: number;
  onExit: () => void;
}

function toggleFS() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.({ navigationUI: "hide" })?.catch(() => {});
}

export default function MultiplayerGame({ lobbyId, startLevel, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const user = useAccountStore(s => s.user);
  const token = useAccountStore(s => s.token);
  const completeLevel = useGameStore(s => s.completeLevel);
  const addDeath = useGameStore(s => s.addDeath);

  const sendPlayerState = useMultiplayerStore(s => s.sendPlayerState);
  const sendLevelAdvance = useMultiplayerStore(s => s.sendLevelAdvance);
  const setLevelAdvanceCallback = useMultiplayerStore(s => s.setLevelAdvanceCallback);
  const remotePlayers = useMultiplayerStore(s => s.remotePlayers);
  const myColorIndex = useMultiplayerStore(s => s.myColorIndex);

  const levelNumRef = useRef(startLevel);
  const levelRef = useRef<LevelData>(generateLevel(startLevel));
  const playerRef = useRef<Player>({ x: 0, y: 0, vx: 0, vy: 0, onGround: false, dead: false, deathTimer: 0, facingRight: true, walkTimer: 0 });
  const keysRef = useRef({ left: false, right: false, jumpJustPressed: false });
  const camXRef = useRef(0);
  const winTimerRef = useRef(-1);
  const remoteRef = useRef(remotePlayers);
  const lastSendRef = useRef(0);
  const wasOnGroundRef = useRef(false);
  const hasDiedRef = useRef(false);
  const hasWonRef = useRef(false);

  useEffect(() => { remoteRef.current = remotePlayers; }, [remotePlayers]);

  function respawn() {
    const lv = levelRef.current;
    resetLevelState(lv);
    const p = playerRef.current;
    p.x = lv.playerStart.x; p.y = lv.playerStart.y;
    p.vx = 0; p.vy = 0; p.onGround = false;
    p.dead = false; p.deathTimer = 0;
    camXRef.current = 0; winTimerRef.current = -1;
    hasDiedRef.current = false;
    hasWonRef.current = false;
  }

  function goToLevel(n: number) {
    levelNumRef.current = n;
    levelRef.current = generateLevel(n);
    respawn();
  }

  // Handle level_advance from server
  useEffect(() => {
    setLevelAdvanceCallback((nextLevel) => {
      goToLevel(nextLevel);
    });
    return () => setLevelAdvanceCallback(null);
  }, []);

  // Start at correct level
  useEffect(() => {
    goToLevel(startLevel);
  }, [startLevel]);

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
      if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") && !e.repeat) k.jumpJustPressed = true;
      if (e.code === "KeyF") toggleFS();
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
      const now = Date.now();
      const wasOnGround = wasOnGroundRef.current;

      if (winTimerRef.current >= 0) {
        winTimerRef.current += FDT;
        if (winTimerRef.current > 1200) {
          const next = levelNumRef.current + 1;
          if (next <= TOTAL_LEVELS) {
            sendLevelAdvance(next);
            goToLevel(next);
          } else {
            onExit();
          }
        }
        return;
      }

      if (p.dead) {
        p.deathTimer += FDT;
        if (p.deathTimer > 750) {
          addDeath(levelNumRef.current);
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
        if (landed && !wasOnGround) sounds.land();
        if (landed && plat.type === "disappear" && !plat.disappearing) {
          plat.standTimer += FDT;
          if (plat.standTimer > 300) plat.disappearing = true;
        }
        if (!landed && plat.type === "disappear" && !plat.disappearing) {
          plat.standTimer = Math.max(0, plat.standTimer - FDT * 2);
        }
      }
      wasOnGroundRef.current = p.onGround;

      for (const plat of lv.platforms) {
        if (plat.disappearing) { plat.alpha -= 0.025; if (plat.alpha <= 0) { plat.alpha = 0; plat.gone = true; } }
        if (plat.type === "moving" && !plat.gone) { plat.t += plat.moveSpeed; plat.x = plat.baseX + Math.sin(plat.t) * plat.moveRange; }
      }

      for (const sp of lv.spikes) {
        if (sp.type === "popup" && !sp.revealed && p.x + PLAYER_W > sp.triggerMinX && p.x < sp.triggerMaxX) sp.revealed = true;
        if (sp.type === "popup" && sp.revealed) {
          sp.revealTimer += FDT;
          sp.revealAnim = Math.min(1, sp.revealTimer / sp.popupDelay);
          if (sp.revealTimer >= sp.popupDelay) sp.active = true;
        }
        if (sp.type === "moving") { sp.t += sp.moveSpeed; sp.x = sp.baseX + Math.sin(sp.t) * sp.moveRange; }
      }

      for (const tr of lv.trolls) {
        tr.x += tr.vx;
        tr.walkTimer += Math.abs(tr.vx);
        if (tr.x <= tr.patrolLeft) { tr.x = tr.patrolLeft; tr.vx = Math.abs(tr.vx); }
        if (tr.x >= tr.patrolRight) { tr.x = tr.patrolRight; tr.vx = -Math.abs(tr.vx); }
        if (!p.dead && rectOverlap(p.x + 2, p.y + 2, PLAYER_W - 4, PLAYER_H - 4, tr.x, tr.y, TROLL_W, TROLL_H)) {
          sounds.troll(); p.dead = true; p.deathTimer = 0;
        }
      }

      if (p.y > LEVEL_H + TILE * 2) { sounds.die(); p.dead = true; p.deathTimer = 0; return; }

      for (const sp of lv.spikes) {
        if (!sp.active) continue;
        if (rectOverlap(p.x + 3, p.y + 3, PLAYER_W - 6, PLAYER_H - 5, sp.x, sp.y, sp.w, sp.h)) {
          sounds.spike(); p.dead = true; p.deathTimer = 0; return;
        }
      }

      const d = lv.door;
      if (winTimerRef.current < 0 && rectOverlap(p.x, p.y, PLAYER_W, PLAYER_H, d.x, d.y, d.w, d.h)) {
        winTimerRef.current = 0;
        sounds.door();
        completeLevel();
      }

      // Broadcast player state ~20fps
      const now2 = Date.now();
      if (now2 - lastSendRef.current > 50) {
        lastSendRef.current = now2;
        sendPlayerState({ x: p.x, y: p.y, facingRight: p.facingRight, onGround: p.onGround, dead: p.dead, level: levelNumRef.current });
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

      drawBg(ctx, lv.bgColor, camX);
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(Math.round(camX), LEVEL_H, BASE_W, BASE_H);

      for (const plat of lv.platforms) drawPlat(ctx, plat, lv.platformColor, lv.platformDark);
      drawDoor(ctx, lv.door, winTimerRef.current >= 0);
      for (const sp of lv.spikes) drawSpike(ctx, sp);
      for (const tr of lv.trolls) drawTroll(ctx, tr, now);

      // Draw remote players
      for (const rp of remoteRef.current) {
        if (rp.level === levelNumRef.current) {
          drawRemotePlayer(ctx, rp);
        }
      }

      drawLocalPlayer(ctx, p, PLAYER_COLORS[myColorIndex] ?? lv.accentColor);

      // Win overlay
      if (winTimerRef.current >= 0) {
        const a = Math.min(0.6, winTimerRef.current / 1200 * 0.6);
        ctx.fillStyle = `rgba(255,220,50,${a})`;
        ctx.fillRect(Math.round(camX), 0, BASE_W, BASE_H);
      }

      ctx.restore();

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, 0, BASE_W, 14);
      ctx.font = "bold 8px 'Courier New', monospace";
      ctx.textBaseline = "middle";
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#22bbff";
      ctx.textAlign = "left";
      ctx.fillText(`🎮 MULTI`, 4, 7);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(`LEVEL ${lv.num}`, BASE_W / 2, 7);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "right";
      ctx.fillText(`${(remoteRef.current.length + 1)}P`, BASE_W - 4, 7);

      // Progress bar
      const prog = Math.max(0, Math.min(1, p.x / Math.max(1, lv.widthPx - PLAYER_W)));
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(BASE_W * 0.25, 10, BASE_W * 0.5, 2);
      ctx.fillStyle = PLAYER_COLORS[myColorIndex] ?? "#55ff22";
      ctx.fillRect(BASE_W * 0.25, 10, BASE_W * 0.5 * prog, 2);

      // Win banner
      if (winTimerRef.current >= 0) {
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(BASE_W / 2 - 80, BASE_H / 2 - 16, 160, 32);
        ctx.fillStyle = "#ffee22";
        ctx.textAlign = "center";
        ctx.font = "bold 9px 'Courier New', monospace";
        ctx.fillText("LEVEL COMPLETE!", BASE_W / 2, BASE_H / 2 - 5);
        ctx.fillStyle = "#22bbff";
        ctx.font = "bold 7px 'Courier New', monospace";
        ctx.fillText("Advancing all players…", BASE_W / 2, BASE_H / 2 + 7);
        const pct = Math.min(1, winTimerRef.current / 1200);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(BASE_W / 2 - 60, BASE_H / 2 + 14, 120, 3);
        ctx.fillStyle = "#ffee22";
        ctx.fillRect(BASE_W / 2 - 60, BASE_H / 2 + 14, 120 * pct, 3);
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
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <canvas ref={canvasRef} width={BASE_W} height={BASE_H} style={{ display: "block", imageRendering: "pixelated" }} />
      <button onClick={onExit} style={{
        position: "fixed", top: 10, left: 10, zIndex: 50,
        background: "rgba(180,40,40,0.85)", border: "2px solid rgba(255,80,80,0.5)",
        color: "#fff", fontFamily: "'Courier New', monospace",
        fontWeight: "bold", fontSize: 11, padding: "4px 10px",
        cursor: "pointer", borderRadius: 0,
      }}>✕ LEAVE</button>
      <div style={{
        position: "fixed", top: 10, right: 10, zIndex: 50,
        background: "rgba(0,0,0,0.7)", border: "1px solid #22bbff44",
        color: "#22bbff", fontFamily: "'Courier New', monospace",
        fontSize: 10, padding: "4px 8px", borderRadius: 4,
      }}>
        LOBBY: {lobbyId}
      </div>
    </div>
  );
}
