import { SeededRandom } from "./seededRandom";

export const TILE = 24;
export const LEVEL_ROWS = 10;
export const LEVEL_H = LEVEL_ROWS * TILE;    // 240
export const GROUND_Y = (LEVEL_ROWS - 1) * TILE; // 216
export const BASE_W = 400;
export const BASE_H = 240;
export const TROLL_W = 16;
export const TROLL_H = 16;

export interface Platform {
  id: number;
  x: number; y: number; w: number; h: number;
  type: "solid" | "disappear" | "moving";
  alpha: number;
  standTimer: number;
  disappearing: boolean;
  gone: boolean;
  baseX: number; baseY: number;
  moveAxis: "x" | "y";
  moveRange: number;
  moveSpeed: number;
  t: number;
}

export interface Spike {
  id: number;
  x: number; y: number; w: number; h: number;
  dir: "up" | "down" | "left" | "right";
  type: "static" | "popup" | "moving";
  active: boolean;
  triggerMinX: number;
  triggerMaxX: number;
  popupDelay: number;
  revealed: boolean;
  revealTimer: number;
  revealAnim: number;
  baseX: number; baseY: number;
  moveRange: number;
  moveSpeed: number;
  t: number;
}

export interface Troll {
  id: number;
  x: number; y: number;
  baseX: number;
  vx: number;
  patrolLeft: number;
  patrolRight: number;
  walkTimer: number;
}

export interface LevelData {
  num: number;
  widthPx: number;
  widthTiles: number;
  platforms: Platform[];
  spikes: Spike[];
  trolls: Troll[];
  door: { x: number; y: number; w: number; h: number };
  playerStart: { x: number; y: number };
  bgColor: string;
  platformColor: string;
  platformDark: string;
  accentColor: string;
  groundColor: string;
}

const THEMES = [
  { bg: "#080e06", plat: "#2e5228", platDark: "#182e14", accent: "#55ff22", ground: "#1e3816" },
  { bg: "#100606", plat: "#5a2222", platDark: "#3a1010", accent: "#ff5511", ground: "#3e1414" },
  { bg: "#060610", plat: "#222266", platDark: "#12123c", accent: "#7788ff", ground: "#181840" },
  { bg: "#060e0c", plat: "#205050", platDark: "#102e2e", accent: "#22ffcc", ground: "#163434" },
  { bg: "#0e0e06", plat: "#585015", platDark: "#383408", accent: "#ffee22", ground: "#3a3408" },
  { bg: "#0c060c", plat: "#502850", platDark: "#301430", accent: "#ff33ff", ground: "#341a34" },
  { bg: "#040404", plat: "#303030", platDark: "#1e1e1e", accent: "#bbbbbb", ground: "#222222" },
];

let _id = 0;
const nid = () => ++_id;

function mkPlat(x: number, y: number, w: number, h: number, type: Platform["type"] = "solid"): Platform {
  return { id: nid(), x, y, w, h, type, alpha: 1, standTimer: 0, disappearing: false, gone: false, baseX: x, baseY: y, moveAxis: "x", moveRange: 0, moveSpeed: 0, t: 0 };
}

function mkSpike(x: number, y: number, w: number, h: number, dir: Spike["dir"], type: Spike["type"] = "static"): Spike {
  return { id: nid(), x, y, w, h, dir, type, active: type !== "popup", triggerMinX: x - TILE * 4, triggerMaxX: x + TILE * 4, popupDelay: 400, revealed: false, revealTimer: 0, revealAnim: 0, baseX: x, baseY: y, moveRange: TILE * 3, moveSpeed: 0.025, t: 0 };
}

function getParams(n: number) {
  return {
    cols: Math.min(70, 22 + Math.floor(n / 8)),
    maxHoles: Math.min(10, 2 + Math.floor(n / 15)),
    maxHoleW: n < 15 ? 2 : n < 35 ? 3 : 4,
    // Spikes — ramp up fast
    staticSpikes: n < 5 ? 0 : Math.min(20, Math.floor((n - 5) / 3)),
    popupSpikes:  n < 10 ? 0 : Math.min(14, Math.floor((n - 10) / 5)),
    popupDelayMs: Math.max(80, 540 - Math.max(0, n - 10) * 2),
    ceilSpikes:   n < 15 ? 0 : Math.min(10, Math.floor((n - 15) / 6)),
    movingSpikes: n < 25 ? 0 : Math.min(8, Math.floor((n - 25) / 8)),
    // Troll clusters (3+ popup spikes fire at once)
    trollClusters: n < 30 ? 0 : Math.min(5, Math.floor((n - 30) / 20)),
    // Troll enemies
    numTrolls: n < 20 ? 0 : Math.min(5, Math.floor((n - 20) / 25)),
    disappearPlats: n >= 60,
    movingPlats:    n >= 90,
    extraPlats:     Math.min(5, 1 + Math.floor(n / 40)),
  };
}

export function generateLevel(levelNum: number): LevelData {
  const seed = levelNum * 2654435761 + 987654321;
  const rng = new SeededRandom(seed);
  const p = getParams(levelNum);
  const theme = THEMES[(levelNum - 1) % THEMES.length];
  const cols = p.cols;

  // ── Ground ────────────────────────────────────────────────────
  const ground: boolean[] = Array(cols).fill(true);
  for (let i = 0; i < 3; i++) ground[i] = true;
  for (let i = cols - 4; i < cols; i++) ground[i] = true;

  for (let h = 0; h < p.maxHoles; h++) {
    const hx = rng.int(3, cols - 7);
    const hw = rng.int(2, p.maxHoleW);
    for (let i = hx; i < hx + hw && i < cols - 4; i++) ground[i] = false;
  }

  const platforms: Platform[] = [];
  let segStart = -1;
  for (let x = 0; x <= cols; x++) {
    const here = x < cols && ground[x];
    if (here && segStart === -1) segStart = x;
    if (!here && segStart !== -1) {
      platforms.push(mkPlat(segStart * TILE, GROUND_Y, (x - segStart) * TILE, TILE * 4));
      segStart = -1;
    }
  }

  // Hop-stones over gaps (row 8 = 1 tile above ground)
  let gx = 0;
  while (gx < cols) {
    if (!ground[gx]) {
      let ge = gx;
      while (ge < cols && !ground[ge]) ge++;
      const gapW = ge - gx;
      if (gapW >= 3) {
        const midX = gx + Math.floor(gapW / 2);
        const pw = rng.int(2, 3);
        const ptype: Platform["type"] = p.disappearPlats && rng.bool(0.3) ? "disappear" : "solid";
        platforms.push(mkPlat((midX - 1) * TILE, 8 * TILE, pw * TILE, TILE / 2, ptype));
      }
      gx = ge;
    } else { gx++; }
  }

  // Extra floating platforms
  for (let ep = 0; ep < p.extraPlats; ep++) {
    const ex = rng.int(4, cols - 6);
    const row = rng.int(5, 8);
    const ew = rng.int(2, 4);
    let etype: Platform["type"] = "solid";
    if (p.disappearPlats && rng.bool(0.25)) etype = "disappear";
    if (p.movingPlats && rng.bool(0.2)) etype = "moving";
    const plat = mkPlat(ex * TILE, row * TILE, ew * TILE, TILE / 2, etype);
    if (etype === "moving") {
      plat.moveAxis = "x";
      plat.moveRange = rng.float(TILE * 1.5, TILE * 3.5);
      plat.moveSpeed = rng.float(0.02, 0.04);
      plat.t = rng.float(0, Math.PI * 2);
    }
    platforms.push(plat);
  }

  // ── Spikes ────────────────────────────────────────────────────
  const spikes: Spike[] = [];
  const SW = Math.round(TILE * 0.55);
  const SH = Math.round(TILE * 0.52);

  // Static ground spikes (dense)
  for (let s = 0; s < p.staticSpikes; s++) {
    const sx = rng.int(3, cols - 5);
    if (ground[sx]) {
      const sp = mkSpike(sx * TILE + (TILE - SW) / 2, GROUND_Y - SH, SW, SH, "up", "static");
      sp.active = true;
      spikes.push(sp);
    }
  }

  // Popup spikes (individual)
  for (let pp = 0; pp < p.popupSpikes; pp++) {
    const sx = rng.int(4, cols - 6);
    if (ground[sx]) {
      const sp = mkSpike(sx * TILE + (TILE - SW) / 2, GROUND_Y - SH, SW, SH, "up", "popup");
      sp.popupDelay = rng.float(p.popupDelayMs * 0.75, p.popupDelayMs * 1.25);
      sp.triggerMinX = (sx - 5) * TILE;
      sp.triggerMaxX = (sx + 5) * TILE;
      spikes.push(sp);
    }
  }

  // TROLL CLUSTERS — 3–5 popup spikes firing near-simultaneously, same trigger
  for (let tc = 0; tc < p.trollClusters; tc++) {
    const clusterX = rng.int(5, cols - 10);
    const clusterSize = rng.int(3, 5);
    const sharedTriggerMin = (clusterX - 4) * TILE;
    const sharedTriggerMax = (clusterX + clusterSize + 4) * TILE;
    const baseDelay = rng.float(p.popupDelayMs * 0.5, p.popupDelayMs * 0.8);
    for (let ci = 0; ci < clusterSize; ci++) {
      const sx = clusterX + ci;
      if (sx < cols - 4 && ground[sx]) {
        const sp = mkSpike(sx * TILE + (TILE - SW) / 2, GROUND_Y - SH, SW, SH, "up", "popup");
        sp.popupDelay = baseDelay + ci * 25; // stagger by 25ms
        sp.triggerMinX = sharedTriggerMin;
        sp.triggerMaxX = sharedTriggerMax;
        spikes.push(sp);
      }
    }
  }

  // Ceiling spikes (point down)
  for (let cs = 0; cs < p.ceilSpikes; cs++) {
    const cx = rng.int(4, cols - 5);
    const row = rng.int(0, 2);
    const spType: Spike["type"] = rng.bool(0.5) ? "popup" : "static";
    const sp = mkSpike(cx * TILE + (TILE - SW) / 2, row * TILE, SW, SH, "down", spType);
    if (spType === "popup") {
      sp.popupDelay = rng.float(p.popupDelayMs * 0.8, p.popupDelayMs * 1.4);
      sp.triggerMinX = (cx - 4) * TILE;
      sp.triggerMaxX = (cx + 4) * TILE;
    }
    spikes.push(sp);
  }

  // Platform top spikes
  const floatPlats = platforms.filter(pt => pt.h === TILE / 2 && pt.w >= TILE);
  const numPlatSpikes = Math.min(floatPlats.length, Math.max(0, Math.floor(p.staticSpikes / 3)));
  for (let ps = 0; ps < numPlatSpikes; ps++) {
    const plat = rng.pick(floatPlats);
    const sx = plat.x + rng.float(0, Math.max(0, plat.w - SW));
    const spType: Spike["type"] = p.popupSpikes > 3 && rng.bool(0.45) ? "popup" : "static";
    const sp = mkSpike(sx, plat.y - SH, SW, SH, "up", spType);
    if (spType === "popup") {
      sp.popupDelay = rng.float(p.popupDelayMs * 0.6, p.popupDelayMs);
      sp.triggerMinX = plat.x - TILE * 2;
      sp.triggerMaxX = plat.x + plat.w + TILE * 2;
    }
    spikes.push(sp);
  }

  // Moving spikes (patrol air/platforms)
  for (let ms = 0; ms < p.movingSpikes; ms++) {
    const mx = rng.int(6, cols - 10);
    const row = rng.int(3, LEVEL_ROWS - 2);
    const sp = mkSpike(mx * TILE, row * TILE - SH / 2, SW, SH,
      rng.bool(0.6) ? "up" : "right", "moving");
    sp.moveRange = rng.float(TILE * 2.5, TILE * 6);
    sp.moveSpeed = rng.float(0.03, 0.065);
    sp.t = rng.float(0, Math.PI * 2);
    sp.active = true;
    spikes.push(sp);
  }

  // ── Troll enemies ─────────────────────────────────────────────
  const trolls: Troll[] = [];
  const groundSegs = platforms.filter(plat => plat.y === GROUND_Y && plat.w >= TILE * 4);
  for (let t = 0; t < p.numTrolls; t++) {
    if (groundSegs.length === 0) break;
    const seg = rng.pick(groundSegs);
    const margin = TILE;
    if (seg.w < margin * 2 + TROLL_W) continue;
    const tx = rng.float(seg.x + margin, seg.x + seg.w - margin - TROLL_W);
    trolls.push({
      id: nid(),
      x: tx,
      y: GROUND_Y - TROLL_H,
      baseX: tx,
      vx: rng.bool() ? 1.2 : -1.2,
      patrolLeft: seg.x + 2,
      patrolRight: seg.x + seg.w - TROLL_W - 2,
      walkTimer: 0,
    });
  }

  const door = {
    x: (cols - 2) * TILE + TILE * 0.1,
    y: GROUND_Y - TILE * 2,
    w: Math.round(TILE * 0.8),
    h: TILE * 2,
  };

  return {
    num: levelNum,
    widthPx: cols * TILE,
    widthTiles: cols,
    platforms, spikes, trolls, door,
    playerStart: { x: TILE * 1.2, y: GROUND_Y - TILE },
    bgColor: theme.bg,
    platformColor: theme.plat,
    platformDark: theme.platDark,
    accentColor: theme.accent,
    groundColor: theme.ground,
  };
}

export function resetLevelState(level: LevelData): void {
  for (const p of level.platforms) {
    p.alpha = 1; p.standTimer = 0; p.disappearing = false; p.gone = false;
    p.t = 0; p.x = p.baseX; p.y = p.baseY;
  }
  for (const s of level.spikes) {
    s.active = s.type !== "popup";
    s.revealed = false; s.revealTimer = 0; s.revealAnim = 0;
    s.t = 0; s.x = s.baseX; s.y = s.baseY;
  }
  for (const t of level.trolls) {
    t.x = t.baseX;
    t.vx = Math.abs(t.vx);
    t.walkTimer = 0;
  }
}
