import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface ChatMsg { role: "user" | "assistant" | "system"; content: string; }

/**
 * John — moderator-only AI assistant for Maze Mayhem Mania.
 * Uses the Lovable AI Gateway (Gemini). Auth-protected; verifies the caller
 * is a moderator before answering.
 */
export const askJohn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: ChatMsg[]; imageUrl?: string | null }) => {
    if (!input?.messages || !Array.isArray(input.messages)) throw new Error("messages required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    // Verify moderator
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    const isMod = !!roles?.some((r: any) => r.role === "moderator" || r.role === "admin");
    if (!isMod) throw new Error("Moderator role required");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are John, a friendly moderator assistant inside the game "Maze Mayhem Mania".
You help the moderators tweak the game's live configuration (BOB tips, physics, XP).
You can answer ANY question in plain English. You speak like a helpful WhatsApp friend — short messages, emojis OK.
When the moderator asks you to change something in the game, end your reply with a JSON code block like:
\`\`\`json
{"configPatch": {"bob": {"tips": {"5": "new tip here"}}}}
\`\`\`
Only include the JSON block when you actually want to propose a change. The moderator must click "Upload" to apply it.`;

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
    if (r.status === 429) return { reply: "⚠️ Rate limit hit, try again in a moment.", configPatch: null };
    if (r.status === 402) return { reply: "⚠️ AI credits exhausted — top up in Cloud Settings.", configPatch: null };
    if (!r.ok) {
      const t = await r.text();
      console.error("john ai error", r.status, t);
      return { reply: `Sorry, I hit an error (${r.status}).`, configPatch: null };
    }
    const j = await r.json();
    const reply: string = j.choices?.[0]?.message?.content ?? "(no reply)";

    // Extract optional JSON config patch
    let configPatch: any = null;
    const m = reply.match(/```json\s*([\s\S]*?)```/i);
    if (m) {
      try {
        const parsed = JSON.parse(m[1]);
        if (parsed && typeof parsed === "object") configPatch = parsed.configPatch ?? parsed;
      } catch { /* ignore */ }
    }
    return { reply, configPatch };
  });