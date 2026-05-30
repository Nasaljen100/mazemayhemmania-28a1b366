import { useEffect } from "react";
import { useAccountStore } from "../store/accountStore";

export default function XpBanner() {
  const xpBanner = useAccountStore((s) => s.xpBanner);
  const dismissXpBanner = useAccountStore((s) => s.dismissXpBanner);
  const quests = useAccountStore((s) => s.quests);

  useEffect(() => {
    if (!xpBanner) return;
    const t = setTimeout(dismissXpBanner, 4000);
    return () => clearTimeout(t);
  }, [xpBanner]);

  if (!xpBanner) return null;

  const completedQuests = quests.filter(q => xpBanner.quests.includes(q.id));

  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      background: "rgba(0,0,0,0.9)", border: "2px solid #ffee22",
      fontFamily: "'Courier New', monospace", color: "#fff",
      padding: "14px 18px", minWidth: 200,
      boxShadow: "0 0 24px rgba(255,220,50,0.4)",
      animation: "slidein 0.3s ease",
    }}>
      <style>{`@keyframes slidein { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      <div style={{ color: "#ffee22", fontWeight: "bold", fontSize: 13, marginBottom: 6 }}>
        ⭐ +{xpBanner.amount} XP
      </div>
      {completedQuests.map(q => (
        <div key={q.id} style={{ fontSize: 11, color: "#44ff88", marginTop: 4 }}>
          ✓ Quest: {q.title}
        </div>
      ))}
      <button onClick={dismissXpBanner} style={{
        position: "absolute", top: 6, right: 8, background: "none",
        border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14,
      }}>✕</button>
    </div>
  );
}
