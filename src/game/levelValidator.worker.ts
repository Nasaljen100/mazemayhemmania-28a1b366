/// <reference lib="webworker" />
/**
 * Web Worker: simulates each level with a tile-grid reachability solver.
 * For any level whose door is unreachable from the start, increments a
 * seed offset and retries — up to MAX_ATTEMPTS — to find a solvable seed.
 *
 * The reachability model approximates the platformer's physics:
 *  - Player can walk horizontally on solid tiles.
 *  - From any standable tile, the player can reach tiles within a jump
 *    arc (up to JUMP_HEIGHT tiles up, JUMP_REACH tiles horizontal).
 *  - Static spikes block standing; moving/popup spikes are treated as
 *    avoidable (since they can be timed past).
 */

import {
  generateLevel, TILE, LEVEL_ROWS,
  type LevelData,
} from "./levelGenerator";
import type { ValidatorReport } from "./levelValidator";

const JUMP_HEIGHT = 4;     // tiles
const JUMP_REACH = 5;      // tiles horizontal at peak
const MAX_ATTEMPTS = 12;   // seed bumps before giving up

function buildGrid(level: LevelData) {
  const cols = Math.ceil(level.widthPx / TILE);
  const rows = LEVEL_ROWS;
  // 0 = empty, 1 = solid, 2 = deadly (static spike)
  const grid: Uint8Array = new Uint8Array(cols * rows);
  const idx = (c: number, r: number) => r * cols + c;

  for (const p of level.platforms) {
    const c0 = Math.floor(p.x / TILE);
    const r0 = Math.floor(p.y / TILE);
    const c1 = Math.ceil((p.x + p.w) / TILE);
    const r1 = Math.ceil((p.y + p.h) / TILE);
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
      if (c >= 0 && c < cols && r >= 0 && r < rows) grid[idx(c, r)] = 1;
    }
  }
  for (const s of level.spikes) {
    if (s.type !== "static") continue;
    const c = Math.floor((s.x + s.w / 2) / TILE);
    const r = Math.floor((s.y + s.h / 2) / TILE);
    if (c >= 0 && c < cols && r >= 0 && r < rows) grid[idx(c, r)] = 2;
  }

  return { grid, cols, rows, idx };
}

function isSolvable(level: LevelData): boolean {
  const { grid, cols, rows, idx } = buildGrid(level);

  const startC = Math.floor(level.playerStart.x / TILE);
  const startR = Math.floor(level.playerStart.y / TILE);
  const doorC = Math.floor((level.door.x + level.door.w / 2) / TILE);
  const doorR = Math.floor((level.door.y + level.door.h / 2) / TILE);

  const visited = new Uint8Array(cols * rows);
  const stack: Array<[number, number]> = [[startC, startR]];
  visited[idx(startC, startR)] = 1;

  while (stack.length) {
    const [c, r] = stack.pop()!;

    // Door reached?
    if (Math.abs(c - doorC) <= 1 && Math.abs(r - doorR) <= 1) return true;

    // Neighbors: walk, fall, jump
    const neighbors: Array<[number, number]> = [];
    // Horizontal walk
    neighbors.push([c - 1, r], [c + 1, r]);
    // Fall straight down (gravity)
    neighbors.push([c, r + 1]);
    // Jump arcs (up to JUMP_HEIGHT vertical, JUMP_REACH horizontal)
    for (let dx = -JUMP_REACH; dx <= JUMP_REACH; dx++) {
      for (let dy = -JUMP_HEIGHT; dy <= 0; dy++) {
        if (dx === 0 && dy === 0) continue;
        neighbors.push([c + dx, r + dy]);
      }
    }

    for (const [nc, nr] of neighbors) {
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const i = idx(nc, nr);
      if (visited[i]) continue;
      if (grid[i] === 1 || grid[i] === 2) continue; // solid or deadly
      visited[i] = 1;
      stack.push([nc, nr]);
    }
  }
  return false;
}

self.onmessage = (ev: MessageEvent) => {
  const { total, seedOverrides } = ev.data as {
    total: number;
    seedOverrides: Record<number, number>;
  };

  const t0 = Date.now();
  const fixed: number[] = [];
  const unfixable: number[] = [];

  for (let level = 1; level <= total; level++) {
    let offset = seedOverrides[level] ?? 0;
    let ok = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Re-create the level using the candidate offset. We can't read
      // localStorage from inside the worker for the *current* override,
      // so we patch the seed inline by mutating the generator's input:
      // we approximate by calling generateLevel and then re-seeding via
      // the offset → since the generator's seed math is deterministic on
      // levelNum alone, we re-run with a synthetic levelNum that yields
      // the desired offset. Simpler: just bump levelNum-based seed by
      // calling generateLevel many times with different "virtual" nums.
      //
      // levelGenerator reads `mmm:seed:<n>` from localStorage; in the
      // worker that returns null, so the generator uses the base seed
      // plus the offset we encode through a helper:
      const data = generateWithOffset(level, offset);
      if (isSolvable(data)) { ok = true; break; }
      offset += 1;
    }
    if (ok) {
      if (offset !== (seedOverrides[level] ?? 0)) {
        fixed.push(level);
        (self as unknown as Worker).postMessage({ kind: "fix", level, offset });
      }
    } else {
      unfixable.push(level);
    }
  }

  const report: ValidatorReport = {
    ranAt: Date.now(),
    total,
    fixed,
    unfixable,
    durationMs: Date.now() - t0,
  };
  (self as unknown as Worker).postMessage({ kind: "done", report });
};

/** Bypass levelGenerator's localStorage seed lookup by piping the offset
 *  through the level number's seed transform manually. We replicate the
 *  base seed formula and reach into the generator via a tiny hack: we
 *  temporarily inject the offset by re-running generateLevel — and since
 *  the worker has no localStorage, we need a different mechanism. */
function generateWithOffset(levelNum: number, offset: number): LevelData {
  // The generator's effective seed is:
  //   levelNum * 2654435761 + 987654321 + offset * 1013904223
  // To force the offset without touching localStorage, we exploit that
  // generateLevel(N) computes seed purely from N + override. We can find
  // an alternate level number N' whose base seed equals our target seed:
  //   N' = N + offset * (1013904223 / 2654435761) — but that isn't integer.
  // Instead, monkey-patch globalThis.localStorage for this call.
  const fakeStore: Record<string, string> = { [`mmm:seed:${levelNum}`]: String(offset) };
  const original = (globalThis as any).localStorage;
  (globalThis as any).localStorage = {
    getItem: (k: string) => fakeStore[k] ?? null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
  try {
    return generateLevel(levelNum);
  } finally {
    (globalThis as any).localStorage = original;
  }
}

export {}; // make this a module