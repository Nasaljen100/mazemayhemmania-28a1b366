import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface ChatMsg { role: "user" | "assistant" | "system"; content: string; }

async function assertMod(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isMod = !!roles?.some((r: any) => r.role === "moderator" || r.role === "admin");
  if (!isMod) throw new Error("Moderator role required");
}

/**
 * John — moderator-only AI assistant for Maze Mayhem Mania.
 * Uses Lovable AI Gateway (Gemini). Can propose patches the mod uploads.
 */
export const askJohn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: ChatMsg[]; imageUrl?: string | null }) => {
    if (!input?.messages || !Array.isArray(input.messages)) throw new Error("messages required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertMod(supabase, userId);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are John, the all-powerful moderator AI inside "Maze Mayhem Mania".
You speak chat-friendly, short, emojis OK. You can answer ANYTHING.

You have REAL powers (the moderator triggers them):
- Edit live game config (BOB tips, physics, XP rates, themes, colors, button labels). Propose a JSON patch.
- Generate or replace AI weekly levels (1..10 main + bonus).
- Ban/unban users, reset passwords, grant/remove XP, give/remove moderator role.

When you want to propose a global LIVE-CONFIG change, end with:
\`\`\`json
{"configPatch": {"bob": {"tips": {"5": "new tip"}}, "physics": {"gravity": 0.3}}}
\`\`\`
When the moderator asks an ADMIN action (ban/xp/role/password/weekly), end with:
\`\`\`json
{"adminAction": {"type": "set_xp", "username": "alice", "xp": 500}}
\`\`\`
adminAction.type ∈ ["set_xp","ban","unban","set_role","reset_password","generate_weekly_levels","broadcast"].
The moderator must click Upload (config) or Small Update (admin action) to apply.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...data.messages,
    ];
    if (data.imageUrl) {
      messages.push({ role: "user", content: `[Image attached: ${data.imageUrl}]` });
    }

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
    });
    if (r.status === 429) return { reply: "⚠️ Rate limit hit, try again in a moment.", configPatch: null, adminAction: null };
    if (r.status === 402) return { reply: "⚠️ AI credits exhausted — top up in Cloud Settings.", configPatch: null, adminAction: null };
    if (!r.ok) {
      const t = await r.text();
      console.error("john ai error", r.status, t);
      return { reply: `Sorry, I hit an error (${r.status}).`, configPatch: null, adminAction: null };
    }
    const j = await r.json();
    const reply: string = j.choices?.[0]?.message?.content ?? "(no reply)";

    let configPatch: any = null;
    let adminAction: any = null;
    const m = reply.match(/```json\s*([\s\S]*?)```/i);
    if (m) {
      try {
        const parsed = JSON.parse(m[1]);
        if (parsed?.configPatch) configPatch = parsed.configPatch;
        if (parsed?.adminAction) adminAction = parsed.adminAction;
        if (!configPatch && !adminAction && parsed && typeof parsed === "object") configPatch = parsed;
      } catch { /* ignore */ }
    }

    // Persist conversation (memory)
    try {
      await supabase.from("john_messages").insert([
        { user_id: userId, role: "user", content: data.messages[data.messages.length - 1]?.content ?? "", image_url: data.imageUrl ?? null },
        { user_id: userId, role: "assistant", content: reply },
      ]);
    } catch { /* ignore memory failures */ }

    return { reply, configPatch, adminAction };
  });

/** Load John conversation memory for the current moderator. */
export const loadJohnHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertMod(supabase, userId);
    const { data } = await supabase
      .from("john_messages")
      .select("role, content, image_url, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(200);
    return { messages: data ?? [] };
  });

/** Execute an admin action proposed by John (small-update button). */
export const runJohnAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { action: any }) => {
    if (!input?.action?.type) throw new Error("action.type required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertMod(supabase, userId);

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    async function userIdByUsername(uname: string): Promise<string | null> {
      const { data: p } = await admin.from("profiles").select("id").ilike("username", uname).maybeSingle();
      return p?.id ?? null;
    }

    const a = data.action;
    try {
      switch (a.type) {
        case "set_xp": {
          const uid = await userIdByUsername(a.username);
          if (!uid) return { ok: false, message: `User ${a.username} not found` };
          await admin.from("profiles").update({ xp: Math.max(0, Number(a.xp) || 0) }).eq("id", uid);
          return { ok: true, message: `XP set to ${a.xp} for ${a.username}` };
        }
        case "ban": {
          const uid = await userIdByUsername(a.username);
          if (!uid) return { ok: false, message: `User ${a.username} not found` };
          await admin.auth.admin.updateUserById(uid, { ban_duration: a.duration || "8760h" });
          return { ok: true, message: `Banned ${a.username}` };
        }
        case "unban": {
          const uid = await userIdByUsername(a.username);
          if (!uid) return { ok: false, message: `User ${a.username} not found` };
          await admin.auth.admin.updateUserById(uid, { ban_duration: "none" });
          return { ok: true, message: `Unbanned ${a.username}` };
        }
        case "set_role": {
          const uid = await userIdByUsername(a.username);
          if (!uid) return { ok: false, message: `User ${a.username} not found` };
          if (a.add) await admin.from("user_roles").upsert({ user_id: uid, role: a.role }, { onConflict: "user_id,role" });
          else await admin.from("user_roles").delete().eq("user_id", uid).eq("role", a.role);
          return { ok: true, message: `Role ${a.role} ${a.add ? "added to" : "removed from"} ${a.username}` };
        }
        case "reset_password": {
          const uid = await userIdByUsername(a.username);
          if (!uid) return { ok: false, message: `User ${a.username} not found` };
          const newPw = a.password || Math.random().toString(36).slice(2, 12) + "A1!";
          await admin.auth.admin.updateUserById(uid, { password: newPw });
          return { ok: true, message: `Password for ${a.username} reset to: ${newPw}` };
        }
        case "generate_weekly_levels": {
          // Bump live_config to trigger client to regenerate AI levels with a new seed.
          const seed = Date.now();
          const { data: cur } = await admin.from("live_config").select("data").eq("id", 1).maybeSingle();
          const merged = { ...(cur?.data as any ?? {}), weeklySeed: seed, weeklyTimestamp: new Date().toISOString() };
          merged.version = (merged.version ?? 0) + 1;
          await admin.from("live_config").update({ data: merged, updated_by: userId, updated_at: new Date().toISOString() }).eq("id", 1);
          await admin.from("broadcasts").insert({ type: "update", payload: { message: "New weekly levels!", version: merged.version }, created_by: userId });
          return { ok: true, message: `Weekly levels regenerated (seed ${seed})` };
        }
        case "broadcast": {
          await admin.from("broadcasts").insert({ type: "message", payload: { message: a.message ?? "Hello!" }, created_by: userId });
          return { ok: true, message: "Broadcast sent" };
        }
        default:
          return { ok: false, message: `Unknown action: ${a.type}` };
      }
    } catch (e: any) {
      return { ok: false, message: e?.message ?? "Action failed" };
    }
  });