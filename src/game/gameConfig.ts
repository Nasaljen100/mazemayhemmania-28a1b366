// Game version and level configuration
// This file is updated weekly by the AI version system

export const GAME_VERSION = "v1.2";

export const VERSION_HISTORY = [
  { version: "v1.0", totalLevels: 628, date: "2026-05-29", note: "Initial launch" },
  { version: "v1.1", totalLevels: 640, date: "2026-06-05", note: "AI added 12 levels" },
  { version: "v1.2", totalLevels: 655, date: "2026-06-12", note: "AI added 15 levels" },
] as const;

export const TOTAL_LEVELS = VERSION_HISTORY[VERSION_HISTORY.length - 1].totalLevels;
export const NEXT_UPDATE = "2026-06-19";

// Player colors for multiplayer (6 distinct accent colors)
export const PLAYER_COLORS = [
  "#55ff22", // green (host/self)
  "#22bbff", // blue
  "#ffdd00", // yellow
  "#ff5533", // orange-red
  "#cc44ff", // purple
  "#ff88cc", // pink
];
