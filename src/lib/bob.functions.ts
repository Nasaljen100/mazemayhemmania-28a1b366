import { createServerFn } from "@tanstack/react-start";

/**
 * BOB — in-game buddy AI. Uses the user-provided OpenAI key.
 * Public (unauth) — only returns short tips; no DB writes.
 */
export const askBob = createServerFn({ method: "POST" })
  .inputValidator((input: { level: number; question?: string }) => input)
  .handler(async ({ data }) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return { reply: "BOB needs an OpenAI key to chat. Tell a moderator!" };
    const sys = `You are BOB, a tiny pixel buddy inside "Maze Mayhem Mania", a 628-level platformer with spikes, trolls, disappearing/moving platforms, popup spikes, double jump (Space x2) and dash (Shift/J/X). Keep replies under 140 chars, playful, helpful. The user might ask for a tip about the current level or any question about the game.`;
    const user = data.question?.trim()
      ? `Level ${data.level}. Player asks: ${data.question}`
      : `Give a one-line tip for level ${data.level}.`;
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: sys }, { role: "user", content: user }],
          max_tokens: 80, temperature: 0.8,
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error("bob openai error", r.status, t);
        if (r.status === 401) return { reply: "BOB's API key was rejected by OpenAI." };
        if (r.status === 429) return { reply: "BOB is rate-limited — try again in a sec." };
        return { reply: `BOB error ${r.status}.` };
      }
      const j = await r.json();
      const reply = (j.choices?.[0]?.message?.content ?? "").trim() || "(BOB shrugs)";
      return { reply };
    } catch (e) {
      console.error("bob error", e);
      return { reply: "BOB couldn't reach OpenAI (network error)." };
    }
  });