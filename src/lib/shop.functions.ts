import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { BOXES, RARITY_PRICE, RARITY_WEIGHT, getCharacterCatalog, rollCharacter, upgradeCostFor, type Rarity } from "@/game/characters";

const RESTOCK_MS = 10 * 60 * 1000;

async function ensureFreshStock(supabase: any) {
  const { data: row } = await supabase.from("shop_stock").select("*").eq("id", 1).maybeSingle();
  const stale = !row || (Date.now() - new Date(row.restocked_at).getTime() > RESTOCK_MS);
  if (!stale) return row;
  // Roll 20 unique characters weighted by rarity
  const cat = getCharacterCatalog();
  const totalW = cat.reduce((s, c) => s + RARITY_WEIGHT[c.rarity], 0);
  const picked = new Set<number>();
  const slots: Array<{ character_id: number; price: number; rarity: Rarity }> = [];
  let guard = 0;
  while (slots.length < 20 && guard++ < 500) {
    let r = Math.random() * totalW;
    for (const c of cat) {
      r -= RARITY_WEIGHT[c.rarity];
      if (r <= 0) {
        if (!picked.has(c.id)) {
          picked.add(c.id);
          slots.push({ character_id: c.id, price: RARITY_PRICE[c.rarity], rarity: c.rarity });
        }
        break;
      }
    }
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("shop_stock").update({ slots, restocked_at: new Date().toISOString() }).eq("id", 1);
  return { id: 1, slots, restocked_at: new Date().toISOString() };
}

export const getShop = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const stock = await ensureFreshStock(context.supabase);
    return { slots: stock.slots, restockedAt: stock.restocked_at };
  });

export const buyCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { characterId: number }) => z.object({ characterId: z.number().int().min(1).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const stock = await ensureFreshStock(supabase);
    const slot = (stock.slots as any[]).find((s) => s.character_id === data.characterId);
    if (!slot) return { ok: false, message: "Not in shop right now" };
    const { data: prof } = await supabase.from("profiles").select("xp").eq("id", userId).single();
    if ((prof?.xp ?? 0) < slot.price) return { ok: false, message: "Not enough XP" };
    // Already own?
    const { data: owned } = await supabase.from("user_characters").select("id").eq("user_id", userId).eq("character_id", data.characterId).maybeSingle();
    if (owned) return { ok: false, message: "Already owned" };
    await supabase.from("profiles").update({ xp: (prof?.xp ?? 0) - slot.price }).eq("id", userId);
    await supabase.from("user_characters").insert({ user_id: userId, character_id: data.characterId });
    return { ok: true, message: "Purchased!", spent: slot.price };
  });

export const openBox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { boxId: number }) => z.object({ boxId: z.number().int().min(1).max(10) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const box = BOXES.find((b) => b.id === data.boxId);
    if (!box) return { ok: false, message: "Unknown box" };
    const { data: prof } = await supabase.from("profiles").select("xp").eq("id", userId).single();
    if ((prof?.xp ?? 0) < box.price) return { ok: false, message: "Not enough XP" };
    const rolled = rollCharacter(Math.floor(Math.random() * 1e9), box.pool);
    await supabase.from("profiles").update({ xp: (prof?.xp ?? 0) - box.price }).eq("id", userId);
    // Insert or skip if owned — still consume the box but return "duplicate".
    const { error } = await supabase.from("user_characters").insert({ user_id: userId, character_id: rolled.id });
    return { ok: true, message: error ? "Duplicate — XP refunded" : `You got ${rolled.name}!`, character: { id: rolled.id, name: rolled.name, rarity: rolled.rarity }, duplicate: !!error };
  });

export const equipCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { characterId: number }) => z.object({ characterId: z.number().int() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("user_characters").update({ equipped: false }).eq("user_id", userId);
    const { error } = await supabase.from("user_characters").update({ equipped: true }).eq("user_id", userId).eq("character_id", data.characterId);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  });

export const upgradeCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { characterId: number; levels: number }) => z.object({
    characterId: z.number().int(), levels: z.number().int().min(1).max(50),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: own } = await supabase.from("user_characters").select("upgrade_level").eq("user_id", userId).eq("character_id", data.characterId).maybeSingle();
    if (!own) return { ok: false, message: "You don't own that character" };
    let cost = 0;
    for (let i = 0; i < data.levels; i++) cost += upgradeCostFor((own.upgrade_level ?? 0) + i);
    const { data: prof } = await supabase.from("profiles").select("xp").eq("id", userId).single();
    if ((prof?.xp ?? 0) < cost) return { ok: false, message: `Need ${cost} XP` };
    await supabase.from("profiles").update({ xp: (prof?.xp ?? 0) - cost }).eq("id", userId);
    await supabase.from("user_characters").update({ upgrade_level: (own.upgrade_level ?? 0) + data.levels }).eq("user_id", userId).eq("character_id", data.characterId);
    return { ok: true, message: `+${data.levels} levels`, spent: cost };
  });

export const equipBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { badgeId: number }) => z.object({ badgeId: z.number().int() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("user_badges").update({ equipped: false }).eq("user_id", userId);
    const { error } = await supabase.from("user_badges").update({ equipped: true }).eq("user_id", userId).eq("badge_id", data.badgeId);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  });

export const claimBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: prog }, { data: chars }, { data: owned }] = await Promise.all([
      supabase.from("game_progress").select("completed_levels").eq("user_id", userId).maybeSingle(),
      supabase.from("user_characters").select("character_id").eq("user_id", userId),
      supabase.from("user_badges").select("badge_id").eq("user_id", userId),
    ]);
    const cleared = ((prog?.completed_levels as number[]) ?? []).length;
    const ownedCount = (chars ?? []).length;
    const ownedIds = new Set((owned ?? []).map((b: any) => b.badge_id));
    const cat = getCharacterCatalog();
    const ownsMythic = (chars ?? []).some((c: any) => {
      const def = cat.find((x) => x.id === c.character_id);
      return def && ["mythic","godly","secret","event","ultimate"].includes(def.rarity);
    });
    const earn = (id: number) => {
      if (!ownedIds.has(id)) return supabase.from("user_badges").insert({ user_id: userId, badge_id: id });
      return Promise.resolve();
    };
    const newBadges: number[] = [];
    const tryEarn = async (id: number, cond: boolean) => { if (cond && !ownedIds.has(id)) { await earn(id); newBadges.push(id); } };
    await tryEarn(1, true);
    await tryEarn(2, cleared >= 10);
    await tryEarn(3, cleared >= 50);
    await tryEarn(4, cleared >= 200);
    await tryEarn(5, cleared >= 500);
    await tryEarn(6, cleared >= 628);
    await tryEarn(8, ownedCount >= 50);
    await tryEarn(9, ownsMythic);
    return { ok: true, newBadges };
  });

export const restockShopNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isMod = (roles ?? []).some((r: any) => r.role === "moderator" || r.role === "admin");
    if (!isMod) return { ok: false, message: "Mods only" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("shop_stock").update({ slots: [], restocked_at: new Date(0).toISOString() }).eq("id", 1);
    const stock = await ensureFreshStock(supabase);
    return { ok: true, slots: stock.slots };
  });