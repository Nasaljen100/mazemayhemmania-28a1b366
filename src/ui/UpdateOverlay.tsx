import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";

/**
 * Listens for `broadcasts` rows of type "update". When one arrives, shows
 * a full-screen pixel-style 20s loading screen on every client.
 */
export default function UpdateOverlay() {
  const [active, setActive] = useState<{ message: string; until: number } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const ch = supabase
      .channel("global_broadcasts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "broadcasts" },
        (p: any) => {
          const row = p.new;
          if (!row || row.type !== "update") return;
          const msg = (row.payload?.message as string) ?? "Applying update…";
          setActive({ message: msg, until: Date.now() + 20_000 });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(iv);
  }, [active]);

  if (!active) return null;
  const remaining = Math.max(0, active.until - now);
  if (remaining === 0) {
    setTimeout(() => { setActive(null); window.location.reload(); }, 50);
  }
  const pct = 1 - remaining / 20_000;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "radial-gradient(ellipse at 50% 40%, #0a1430, #000)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Courier New', monospace", color: "#fff",
    }}>
      <div style={{ fontSize: 18, color: "#ffee22", letterSpacing: 6, marginBottom: 12 }}>
        ⬆ NEW UPDATE
      </div>
      <div style={{ fontSize: 13, color: "#aaa", marginBottom: 28, maxWidth: 480, textAlign: "center", padding: "0 24px" }}>
        {active.message}
      </div>
      <div style={{
        width: "min(80vw, 360px)", height: 16,
        border: "2px solid #ffee22", padding: 2, background: "rgba(255,238,34,0.08)",
      }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: "#ffee22", transition: "width 0.1s linear" }} />
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: "#888" }}>
        {Math.ceil(remaining / 1000)}s · please wait
      </div>
    </div>
  );
}