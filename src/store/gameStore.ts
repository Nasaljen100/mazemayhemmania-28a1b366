import { create } from "zustand";

export type AppScreen =
  | "menu" | "levelselect" | "playing" | "practice"
  | "auth" | "quests" | "friends" | "lobby" | "multiplayer"
  | "leaderboard" | "weekly" | "settings";

export interface GameStore {
  screen: AppScreen;
  currentLevel: number;
  maxUnlocked: number;
  deathsPerLevel: Record<number, number>;
  completedLevels: Set<number>;
  skippedLevels: Set<number>;
  totalDeaths: number;

  setScreen: (s: AppScreen) => void;
  startLevel: (level: number) => void;
  completeLevel: () => void;
  addDeath: (level: number) => void;
  resetProgress: () => void;
  loadProgress: (p: { maxUnlocked: number; completedLevels: number[]; skippedLevels?: number[]; deathsPerLevel: Record<string, number>; totalDeaths: number }) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: "menu",
  currentLevel: 1,
  maxUnlocked: 1,
  deathsPerLevel: {},
  completedLevels: new Set(),
  skippedLevels: new Set(),
  totalDeaths: 0,

  setScreen: (screen) => set({ screen }),

  startLevel: (level) => set({ screen: "playing", currentLevel: level }),

  completeLevel: () => {
    const { currentLevel, maxUnlocked, completedLevels } = get();
    const newCompleted = new Set(completedLevels);
    newCompleted.add(currentLevel);
    const newMax = Math.max(maxUnlocked, Math.min(628, currentLevel + 1));
    set({ completedLevels: newCompleted, maxUnlocked: newMax });

    // Auto-save to account if logged in (lazy import to avoid circular deps)
    import("./accountStore").then(({ useAccountStore }) => {
      const { saveProgress, token } = useAccountStore.getState();
      if (!token) return;
      const { deathsPerLevel, totalDeaths, skippedLevels } = get();
      saveProgress({
        maxUnlocked: newMax,
        completedLevels: Array.from(newCompleted),
        skippedLevels: Array.from(skippedLevels),
        deathsPerLevel: Object.fromEntries(Object.entries(deathsPerLevel).map(([k, v]) => [k, v])),
        totalDeaths,
      });
    });
  },

  addDeath: (level) => {
    const { deathsPerLevel, totalDeaths } = get();
    set({
      deathsPerLevel: { ...deathsPerLevel, [level]: (deathsPerLevel[level] || 0) + 1 },
      totalDeaths: totalDeaths + 1,
    });
  },

  resetProgress: () =>
    set({
      maxUnlocked: 1,
      deathsPerLevel: {},
      completedLevels: new Set(),
      skippedLevels: new Set(),
      totalDeaths: 0,
      screen: "menu",
      currentLevel: 1,
    }),

  loadProgress: (p) =>
    set({
      maxUnlocked: p.maxUnlocked,
      completedLevels: new Set(p.completedLevels),
      skippedLevels: new Set(p.skippedLevels ?? []),
      deathsPerLevel: Object.fromEntries(Object.entries(p.deathsPerLevel).map(([k, v]) => [Number(k), v])),
      totalDeaths: p.totalDeaths,
    }),
}));
