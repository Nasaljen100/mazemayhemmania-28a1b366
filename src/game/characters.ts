// 100-character procedural catalog for Maze Mayhem Mania.
// Each character is deterministic from its id (1..100). No external assets.

export type Rarity =
  | "common" | "uncommon" | "rare" | "epic"
  | "legendary" | "mythic" | "godly" | "secret" | "event" | "ultimate";

export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  // Stat multipliers / additions applied in Game.tsx physics.
  jumpCount?: number;       // extra mid-air jumps (default ability adds 0)
  speedMul?: number;        // movement speed multiplier
  jumpMul?: number;         // jump velocity multiplier (more negative = higher)
  dashCdMul?: number;       // dash cooldown multiplier (<1 = faster)
  reviveOnce?: boolean;     // revive once per level
  ghostJumpFrames?: number; // extra coyote frames
}

export interface CharacterDef {
  id: number;
  name: string;
  rarity: Rarity;
  body: string;     // hex
  face: string;     // hex
  hat: string;      // hex
  accent: string;   // hex
  hatStyle: "witch" | "crown" | "cap" | "horn" | "halo" | "antenna" | "hood" | "skull" | "none";
  faceStyle: "happy" | "angry" | "cool" | "sleepy" | "robot" | "ghost" | "wink";
  ability: AbilityDef;
}

const RARITY_ORDER: Rarity[] = [
  "common","common","common","common","common","common","common","common", // ~40%
  "uncommon","uncommon","uncommon","uncommon","uncommon","uncommon", // ~20%
  "rare","rare","rare","rare", // ~12%
  "epic","epic","epic", // ~9%
  "legendary","legendary", // ~6%
  "mythic","mythic", // ~5%
  "godly", // ~3%
  "secret", // ~2%
  "event", // ~2%
  "ultimate", // ~1%
];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#aaaaaa",
  uncommon: "#55cc66",
  rare: "#3399ff",
  epic: "#bb44ff",
  legendary: "#ffaa22",
  mythic: "#ff3377",
  godly: "#ffee22",
  secret: "#22ffff",
  event: "#ff66ff",
  ultimate: "#ff2222",
};

export const RARITY_PRICE: Record<Rarity, number> = {
  common: 50,
  uncommon: 150,
  rare: 400,
  epic: 900,
  legendary: 2000,
  mythic: 4500,
  godly: 9000,
  secret: 15000,
  event: 12000,
  ultimate: 25000,
};

// Weight used when rolling shop slots / boxes (higher = more likely)
export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 100, uncommon: 60, rare: 30, epic: 14, legendary: 6,
  mythic: 3, godly: 1.2, secret: 0.6, event: 0.6, ultimate: 0.25,
};

function hash(n: number, salt = 0): number {
  let x = (n * 2654435761 + salt * 374761393) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 2246822507);
  x ^= x >>> 13; x = Math.imul(x, 3266489909);
  x ^= x >>> 16;
  return x >>> 0;
}

const NAMES_A = ["Witch","Ninja","Pirate","Robot","Ghost","Knight","Mage","Vampire","Alien","Dragon","Skeleton","Wizard","Demon","Angel","Samurai","Cowboy","Jester","King","Queen","Mummy"];
const NAMES_B = ["of Spikes","of Doom","of Mania","the Bold","the Sneaky","the Mad","the Sleepy","the Quick","Prime","Ultra","X","Lord","Bot","Punk","Star","Z","Neo","Vortex","Storm","Frost"];
const BODY_PALETTE = ["#ff4488","#22aaff","#44dd66","#ffaa22","#bb44ff","#ff7733","#22ddcc","#dd4422","#7755ff","#66cc44","#cc2266","#3388dd","#88aa22","#aa66ff","#dd9922","#66ddaa","#ff66aa","#55bbff","#cc88ff","#ddaa55"];
const HAT_STYLES: CharacterDef["hatStyle"][] = ["witch","crown","cap","horn","halo","antenna","hood","skull","none"];
const FACE_STYLES: CharacterDef["faceStyle"][] = ["happy","angry","cool","sleepy","robot","ghost","wink"];

function abilityFor(id: number, rarity: Rarity): AbilityDef {
  // Higher rarity → stronger ability
  const tier = ["common","uncommon","rare","epic","legendary","mythic","godly","secret","event","ultimate"].indexOf(rarity);
  const pool: AbilityDef[] = [
    { id: "swift",    name: "Swift Feet",   desc: "+5% move speed",                       speedMul: 1.05 },
    { id: "leaper",   name: "Spring Boots", desc: "+8% jump height",                      jumpMul: 1.08 },
    { id: "coyote",   name: "Coyote Sense", desc: "More forgiving ledge timing",          ghostJumpFrames: 4 },
    { id: "dasher",   name: "Quick Dash",   desc: "-20% dash cooldown",                   dashCdMul: 0.8 },
    { id: "swift2",   name: "Sprinter",     desc: "+12% move speed",                      speedMul: 1.12 },
    { id: "triple",   name: "Triple Jump",  desc: "+1 mid-air jump",                      jumpCount: 1 },
    { id: "dasher2",  name: "Dash Master",  desc: "-40% dash cooldown",                   dashCdMul: 0.6 },
    { id: "leaper2",  name: "Sky Walker",   desc: "+18% jump height",                     jumpMul: 1.18 },
    { id: "revive",   name: "Second Wind",  desc: "Revive once per level",                reviveOnce: true },
    { id: "ultimate", name: "Mania Form",   desc: "+2 jumps, +15% speed, -50% dash CD",   jumpCount: 2, speedMul: 1.15, dashCdMul: 0.5 },
  ];
  return pool[Math.min(tier, pool.length - 1)];
}

let cache: CharacterDef[] | null = null;
export function getCharacterCatalog(): CharacterDef[] {
  if (cache) return cache;
  const out: CharacterDef[] = [];
  for (let i = 1; i <= 100; i++) {
    const r = RARITY_ORDER[(i - 1) % RARITY_ORDER.length];
    const a = NAMES_A[hash(i, 1) % NAMES_A.length];
    const b = NAMES_B[hash(i, 2) % NAMES_B.length];
    out.push({
      id: i,
      name: `${a} ${b}`,
      rarity: r,
      body: BODY_PALETTE[hash(i, 3) % BODY_PALETTE.length],
      face: "#111",
      hat: BODY_PALETTE[hash(i, 4) % BODY_PALETTE.length],
      accent: BODY_PALETTE[hash(i, 5) % BODY_PALETTE.length],
      hatStyle: HAT_STYLES[hash(i, 6) % HAT_STYLES.length],
      faceStyle: FACE_STYLES[hash(i, 7) % FACE_STYLES.length],
      ability: abilityFor(i, r),
    });
  }
  cache = out;
  return out;
}

export function getCharacter(id: number): CharacterDef | undefined {
  return getCharacterCatalog().find((c) => c.id === id);
}

// Apply N upgrade levels to an ability. Every 100 upgrade levels unlocks
// an extra ability tier (jumps, speed). XP cost: 50 * (1 + level).
export function upgradedAbility(base: AbilityDef, upgradeLevel: number): AbilityDef {
  const extraTiers = Math.floor(upgradeLevel / 100);
  const milliBuff = upgradeLevel * 0.002;
  return {
    ...base,
    jumpCount: (base.jumpCount ?? 0) + extraTiers,
    speedMul: (base.speedMul ?? 1) + milliBuff,
    jumpMul: (base.jumpMul ?? 1) + milliBuff,
    dashCdMul: Math.max(0.25, (base.dashCdMul ?? 1) - milliBuff),
    ghostJumpFrames: (base.ghostJumpFrames ?? 0) + Math.floor(upgradeLevel / 25),
  };
}

export function upgradeCostFor(level: number): number {
  return 50 * (1 + Math.floor(level / 5));
}

// Weighted random for shop/box rolls.
export function rollCharacter(seed: number, allowedRarities?: Rarity[]): CharacterDef {
  const cat = getCharacterCatalog();
  const pool = allowedRarities ? cat.filter((c) => allowedRarities.includes(c.rarity)) : cat;
  const totalW = pool.reduce((s, c) => s + RARITY_WEIGHT[c.rarity], 0);
  let r = (hash(seed) / 0xffffffff) * totalW;
  for (const c of pool) {
    r -= RARITY_WEIGHT[c.rarity];
    if (r <= 0) return c;
  }
  return pool[pool.length - 1];
}

// 10 box tiers, each more rare than the last.
export interface BoxDef { id: number; name: string; price: number; pool: Rarity[]; rarity: Rarity; }
export const BOXES: BoxDef[] = [
  { id: 1,  name: "Wood Box",     price: 200,    pool: ["common","uncommon"],                       rarity: "common" },
  { id: 2,  name: "Stone Box",    price: 500,    pool: ["common","uncommon","rare"],                rarity: "uncommon" },
  { id: 3,  name: "Iron Box",     price: 1200,   pool: ["uncommon","rare","epic"],                  rarity: "rare" },
  { id: 4,  name: "Gold Box",     price: 2500,   pool: ["rare","epic","legendary"],                 rarity: "epic" },
  { id: 5,  name: "Diamond Box",  price: 5000,   pool: ["epic","legendary","mythic"],               rarity: "legendary" },
  { id: 6,  name: "Mythic Box",   price: 10000,  pool: ["legendary","mythic","godly"],              rarity: "mythic" },
  { id: 7,  name: "Cosmic Box",   price: 20000,  pool: ["mythic","godly","secret"],                 rarity: "godly" },
  { id: 8,  name: "Void Box",     price: 40000,  pool: ["godly","secret","event"],                  rarity: "secret" },
  { id: 9,  name: "Event Box",    price: 60000,  pool: ["secret","event","ultimate"],               rarity: "event" },
  { id: 10, name: "Ultimate Box", price: 100000, pool: ["event","ultimate","godly"],                rarity: "ultimate" },
];