/**
 * Daily AI-style level validator.
 *
 * Once every 24h (tracked in localStorage), spins up a Web Worker that
 * "plays" every level in parallel via a tile-grid reachability solver.
 * If a level is unsolvable, bumps a per-level seed offset until the
 * generator produces a solvable variant, and stores that offset under
 * `mmm:seed:<level>` — which `levelGenerator.ts` reads at generation time.
 */

import { TOTAL_LEVELS } from "./gameConfig";

const LS_LAST_RUN = "mmm:validator:lastRun";
const LS_REPORT = "mmm:validator:report";
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ValidatorReport {
  ranAt: number;
  total: number;
  fixed: number[];
  unfixable: number[];
  durationMs: number;
}

let _running = false;

export function getLastReport(): ValidatorReport | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_REPORT);
    return raw ? (JSON.parse(raw) as ValidatorReport) : null;
  } catch { return null; }
}

export function startLevelValidator(force = false) {
  if (typeof window === "undefined" || _running) return;
  const last = Number(localStorage.getItem(LS_LAST_RUN) || 0);
  if (!force && Date.now() - last < DAY_MS) return;
  _running = true;

  // Snapshot existing overrides so the worker can build on prior fixes.
  const seedOverrides: Record<number, number> = {};
  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    const raw = localStorage.getItem(`mmm:seed:${i}`);
    if (raw) seedOverrides[i] = Number(raw) || 0;
  }

  const worker = new Worker(
    new URL("./levelValidator.worker.ts", import.meta.url),
    { type: "module" }
  );

  worker.onmessage = (ev: MessageEvent) => {
    const data = ev.data as
      | { kind: "fix"; level: number; offset: number }
      | { kind: "done"; report: ValidatorReport };

    if (data.kind === "fix") {
      localStorage.setItem(`mmm:seed:${data.level}`, String(data.offset));
    } else if (data.kind === "done") {
      localStorage.setItem(LS_LAST_RUN, String(Date.now()));
      localStorage.setItem(LS_REPORT, JSON.stringify(data.report));
      _running = false;
      worker.terminate();
      // eslint-disable-next-line no-console
      console.log(
        `[level-validator] checked ${data.report.total} levels in ${data.report.durationMs}ms — fixed ${data.report.fixed.length}, unfixable ${data.report.unfixable.length}`
      );
    }
  };

  worker.onerror = (err) => {
    console.warn("[level-validator] worker error", err);
    _running = false;
    worker.terminate();
  };

  worker.postMessage({ total: TOTAL_LEVELS, seedOverrides });
}