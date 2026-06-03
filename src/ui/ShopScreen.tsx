import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getShop, buyCharacter, openBox, restockShopNow } from "@/lib/shop.functions";
import { useGameStore } from "../store/gameStore";
import { useAccountStore } from "../store/accountStore";
import { useInventoryStore } from "../store/inventoryStore";
import { CharacterSprite } from "./CharacterSprite";
import { BOXES, getCharacter, RARITY_COLOR, type Rarity } from "../game/characters";

export default function ShopScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const user = useAccountStore((s) => s.user);
  const refreshInv = useInventoryStore((s) => s.refresh);
  const fetchShop = useServerFn(getShop);
  const buy = useServerFn(buyCharacter);
  const openBoxFn = useServerFn(openBox);
  const restock = useServerFn(restockShopNow);

  const [tab, setTab] = useState<"chars"|"boxes">("chars");
  const [slots, setSlots] = useState<any[]>([]);
  const [restockAt, setRestockAt] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [reveal, setReveal] = useState<{ id: number; name: string; rarity: string } | null>(null);

  async function reload() {
    const r: any = await fetchShop({ data: {} } as any);
    setSlots(r.slots ?? []);
    setRestockAt(r.restockedAt ?? "");
  }
  useEffect(() => { reload(); }, []);

  async function doBuy(cid: number) {
    const r: any = await buy({ data: { characterId: cid } });
    setMsg(r.message);
    if (r.ok) {
      await reload();
      if (user) await refreshInv(user.id);
    }
  }

  async function doOpen(boxId: number) {
    const r: any = await openBoxFn({ data: { boxId } });
    setMsg(r.message);
    if (r.character) setReveal(r.character);
    if (user) await refreshInv(user.id);
  }

  return (
    <div style={{ width: "100vw", height: "100vh", overflowY: "auto", background: "#06080f", color: "#fff", fontFamily: "'Courier New', monospace", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => setScreen("menu")} style={btn()}>← BACK</button>
        <h1 style={{ margin: 0, color: "#ffee22" }}>🛒 SHOP</h1>
        <div style={{ marginLeft: "auto", color: "#aaa", fontSize: 12 }}>XP: <span style={{ color: "#ffee22" }}>{user?.xp ?? 0}</span></div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button onClick={() => setTab("chars")} style={btn(tab==="chars")}>CHARACTERS</button>
        <button onClick={() => setTab("boxes")} style={btn(tab==="boxes")}>BOXES</button>
        {user?.isModerator && <button onClick={async () => { const r:any = await restock({data:{}} as any); if (r.ok) { setSlots(r.slots); setMsg("Restocked"); } }} style={{ ...btn(), background: "#aa4422" }}>🔄 RESTOCK (MOD)</button>}
      </div>
      {msg && <div style={{ marginBottom: 12, padding: 8, background: "rgba(34,170,85,0.15)", border: "1px solid #44aa66", color: "#88ffaa" }}>{msg}</div>}
      {tab === "chars" && (
        <>
          <div style={{ color: "#888", fontSize: 11, marginBottom: 10 }}>20 slots · restocks every 10 min · last restock {restockAt && new Date(restockAt).toLocaleTimeString()}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {slots.map((s: any) => {
              const c = getCharacter(s.character_id);
              if (!c) return null;
              return (
                <div key={s.character_id} style={{ background: "#0e1422", border: `2px solid ${RARITY_COLOR[c.rarity]}`, padding: 10, textAlign: "center" }}>
                  <div style={{ display: "grid", placeItems: "center", marginBottom: 6 }}><CharacterSprite character={c} size={72} /></div>
                  <div style={{ fontSize: 11, color: "#fff", fontWeight: "bold" }}>{c.name}</div>
                  <div style={{ fontSize: 9, color: RARITY_COLOR[c.rarity], textTransform: "uppercase", letterSpacing: 1 }}>{c.rarity}</div>
                  <div style={{ fontSize: 9, color: "#aaa", margin: "4px 0" }}>{c.ability.name}: {c.ability.desc}</div>
                  <button onClick={() => doBuy(c.id)} style={{ ...btn(), width: "100%", marginTop: 4, background: "#1a8844" }}>BUY {s.price} XP</button>
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab === "boxes" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {BOXES.map((b) => (
            <div key={b.id} style={{ background: "#0e1422", border: `2px solid ${RARITY_COLOR[b.rarity]}`, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 40 }}>📦</div>
              <div style={{ fontWeight: "bold", color: RARITY_COLOR[b.rarity] }}>{b.name}</div>
              <div style={{ fontSize: 10, color: "#aaa", margin: "4px 0" }}>Pool: {b.pool.join(", ")}</div>
              <button onClick={() => doOpen(b.id)} style={{ ...btn(), width: "100%", background: "#1a4488" }}>OPEN {b.price} XP</button>
            </div>
          ))}
        </div>
      )}
      {reveal && (
        <div onClick={() => setReveal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "grid", placeItems: "center", zIndex: 1000, cursor: "pointer" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#aaa", letterSpacing: 3 }}>YOU GOT</div>
            <CharacterSprite id={reveal.id} size={200} />
            <div style={{ fontSize: 22, color: RARITY_COLOR[reveal.rarity as Rarity], fontWeight: "bold", marginTop: 12 }}>{reveal.name}</div>
            <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 2 }}>{reveal.rarity}</div>
            <div style={{ fontSize: 10, color: "#666", marginTop: 12 }}>click anywhere</div>
          </div>
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