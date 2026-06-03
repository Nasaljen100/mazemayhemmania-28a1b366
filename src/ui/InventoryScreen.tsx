import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { equipCharacter, upgradeCharacter, equipBadge, claimBadges } from "@/lib/shop.functions";
import { useGameStore } from "../store/gameStore";
import { useAccountStore } from "../store/accountStore";
import { useInventoryStore } from "../store/inventoryStore";
import { CharacterSprite } from "./CharacterSprite";
import { getCharacter, getCharacterCatalog, RARITY_COLOR, upgradeCostFor, upgradedAbility } from "../game/characters";

export default function InventoryScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const user = useAccountStore((s) => s.user);
  const inv = useInventoryStore();
  const refreshInv = useInventoryStore((s) => s.refresh);

  const equipChar = useServerFn(equipCharacter);
  const upgradeChar = useServerFn(upgradeCharacter);
  const equipBg = useServerFn(equipBadge);
  const claim = useServerFn(claimBadges);

  const [tab, setTab] = useState<"chars"|"badges">("chars");
  const [msg, setMsg] = useState("");

  useEffect(() => { if (user) { refreshInv(user.id); claim({ data: {} } as any).catch(() => {}); } }, [user?.id]);

  const ownedIds = new Set(inv.characters.map((c) => c.character_id));
  const cat = getCharacterCatalog();

  async function equipC(id: number) { await equipChar({ data: { characterId: id } }); if (user) await refreshInv(user.id); }
  async function upgrade(id: number, levels: number) {
    const r: any = await upgradeChar({ data: { characterId: id, levels } });
    setMsg(r.message || (r.ok ? "Upgraded" : "Failed"));
    if (user) await refreshInv(user.id);
  }
  async function equipB(id: number) { await equipBg({ data: { badgeId: id } }); if (user) await refreshInv(user.id); }

  return (
    <div style={{ width: "100vw", height: "100vh", overflowY: "auto", background: "#06080f", color: "#fff", fontFamily: "'Courier New', monospace", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => setScreen("menu")} style={btn()}>← BACK</button>
        <h1 style={{ margin: 0, color: "#ffee22" }}>🎒 INVENTORY</h1>
        <div style={{ marginLeft: "auto", color: "#aaa", fontSize: 12 }}>XP: <span style={{ color: "#ffee22" }}>{user?.xp ?? 0}</span> · Owned: {inv.characters.length}/100</div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button onClick={() => setTab("chars")} style={btn(tab==="chars")}>CHARACTERS</button>
        <button onClick={() => setTab("badges")} style={btn(tab==="badges")}>BADGES</button>
      </div>
      {msg && <div style={{ marginBottom: 12, padding: 8, background: "rgba(34,170,85,0.15)", border: "1px solid #44aa66", color: "#88ffaa" }}>{msg}</div>}
      {tab === "chars" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
          {cat.map((c) => {
            const owned = inv.characters.find((x) => x.character_id === c.id);
            const isOwned = !!owned;
            const isEquipped = owned?.equipped;
            const ab = isOwned ? upgradedAbility(c.ability, owned!.upgrade_level) : c.ability;
            return (
              <div key={c.id} style={{ background: "#0e1422", border: `2px solid ${isOwned ? RARITY_COLOR[c.rarity] : "#222"}`, padding: 10, textAlign: "center", opacity: isOwned ? 1 : 0.4, position: "relative" }}>
                {!isOwned && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 40 }}>🔒</div>}
                <div style={{ display: "grid", placeItems: "center", marginBottom: 4 }}><CharacterSprite character={c} size={64} /></div>
                <div style={{ fontSize: 11, color: "#fff", fontWeight: "bold" }}>{c.name}</div>
                <div style={{ fontSize: 9, color: RARITY_COLOR[c.rarity], textTransform: "uppercase" }}>{c.rarity}</div>
                {isOwned && (
                  <>
                    <div style={{ fontSize: 9, color: "#aaa", margin: "4px 0", minHeight: 24 }}>{ab.name}: {ab.desc}</div>
                    <div style={{ fontSize: 9, color: "#ffee22" }}>Upgrade Lv {owned!.upgrade_level}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      <button onClick={() => equipC(c.id)} style={{ ...btn(isEquipped), flex: 1 }}>{isEquipped ? "EQUIPPED" : "EQUIP"}</button>
                      <button onClick={() => upgrade(c.id, 1)} style={{ ...btn(), padding: "6px 8px" }} title={`Cost ${upgradeCostFor(owned!.upgrade_level)} XP`}>+1</button>
                      <button onClick={() => upgrade(c.id, 10)} style={{ ...btn(), padding: "6px 8px" }}>+10</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      {tab === "badges" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {inv.badgeCatalog.map((b) => {
            const owned = inv.badges.find((x) => x.badge_id === b.id);
            const isEquipped = owned?.equipped;
            return (
              <div key={b.id} style={{ background: "#0e1422", border: `2px solid ${RARITY_COLOR[b.rarity as any] ?? "#888"}`, padding: 10, textAlign: "center", opacity: owned ? 1 : 0.35 }}>
                <div style={{ fontSize: 32 }}>{b.icon}</div>
                <div style={{ fontWeight: "bold" }}>{b.name}</div>
                <div style={{ fontSize: 9, color: RARITY_COLOR[b.rarity as any] ?? "#888", textTransform: "uppercase" }}>{b.rarity}</div>
                <div style={{ fontSize: 10, color: "#888", margin: "6px 0" }}>{b.description}</div>
                {owned && <button onClick={() => equipB(b.id)} style={{ ...btn(isEquipped), width: "100%" }}>{isEquipped ? "EQUIPPED" : "EQUIP"}</button>}
                {!owned && !b.obtainable && <div style={{ fontSize: 9, color: "#ff6666" }}>UNOBTAINABLE</div>}
                {!owned && b.obtainable && <div style={{ fontSize: 9, color: "#888" }}>LOCKED</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function btn(active = false): React.CSSProperties {
  return {
    background: active ? "#ffee22" : "#222a3a",
    color: active ? "#000" : "#fff",
    border: "2px solid rgba(255,255,255,0.1)",
    padding: "6px 12px", fontFamily: "inherit", fontSize: 11,
    fontWeight: "bold", cursor: "pointer", letterSpacing: 1,
  };
}