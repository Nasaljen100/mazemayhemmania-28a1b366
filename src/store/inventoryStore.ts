import { create } from "zustand";
import { supabase } from "../integrations/supabase/client";

export interface OwnedCharacter { character_id: number; xp: number; upgrade_level: number; equipped: boolean; }
export interface OwnedBadge { badge_id: number; equipped: boolean; }
export interface BadgeDef { id: number; name: string; rarity: string; icon: string; description: string; obtainable: boolean; }

interface Store {
  characters: OwnedCharacter[];
  badges: OwnedBadge[];
  badgeCatalog: BadgeDef[];
  equippedCharacterId: number | null;
  equippedBadgeId: number | null;
  loaded: boolean;
  refresh: (userId: string) => Promise<void>;
}

export const useInventoryStore = create<Store>((set) => ({
  characters: [],
  badges: [],
  badgeCatalog: [],
  equippedCharacterId: null,
  equippedBadgeId: null,
  loaded: false,
  refresh: async (userId: string) => {
    const [{ data: chars }, { data: badges }, { data: catalog }] = await Promise.all([
      supabase.from("user_characters").select("*").eq("user_id", userId),
      supabase.from("user_badges").select("*").eq("user_id", userId),
      supabase.from("badges").select("*").order("id"),
    ]);
    const c = (chars ?? []) as OwnedCharacter[];
    const b = (badges ?? []) as OwnedBadge[];
    set({
      characters: c,
      badges: b,
      badgeCatalog: (catalog ?? []) as BadgeDef[],
      equippedCharacterId: c.find((x) => x.equipped)?.character_id ?? null,
      equippedBadgeId: b.find((x) => x.equipped)?.badge_id ?? null,
      loaded: true,
    });
  },
}));