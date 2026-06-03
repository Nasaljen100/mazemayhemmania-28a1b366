import { CharacterDef, getCharacter, RARITY_COLOR } from "../game/characters";

export function CharacterSprite({ id, size = 64, character }: { id?: number; size?: number; character?: CharacterDef }) {
  const c = character ?? (id != null ? getCharacter(id) : undefined);
  if (!c) return <div style={{ width: size, height: size, background: "#333" }} />;
  const aura = RARITY_COLOR[c.rarity];
  return (
    <div style={{
      width: size, height: size, position: "relative",
      filter: `drop-shadow(0 0 6px ${aura})`,
    }}>
      <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges">
        {/* body */}
        <rect x="3" y="6" width="10" height="8" fill={c.body} />
        <rect x="3" y="13" width="3" height="2" fill={c.accent} />
        <rect x="10" y="13" width="3" height="2" fill={c.accent} />
        {/* head */}
        <rect x="4" y="2" width="8" height="5" fill={c.body} />
        {/* face */}
        {face(c)}
        {/* hat */}
        {hat(c)}
      </svg>
    </div>
  );
}

function face(c: CharacterDef) {
  switch (c.faceStyle) {
    case "happy":
      return (<>
        <rect x="5" y="4" width="1" height="1" fill={c.face} />
        <rect x="10" y="4" width="1" height="1" fill={c.face} />
        <rect x="6" y="6" width="4" height="1" fill={c.face} />
      </>);
    case "angry":
      return (<>
        <rect x="5" y="4" width="1" height="2" fill="#ff2222" />
        <rect x="10" y="4" width="1" height="2" fill="#ff2222" />
        <rect x="6" y="6" width="4" height="1" fill={c.face} />
      </>);
    case "cool":
      return (<>
        <rect x="5" y="4" width="6" height="2" fill="#000" />
        <rect x="6" y="7" width="4" height="1" fill={c.face} />
      </>);
    case "sleepy":
      return (<>
        <rect x="5" y="5" width="2" height="1" fill={c.face} />
        <rect x="9" y="5" width="2" height="1" fill={c.face} />
      </>);
    case "robot":
      return (<>
        <rect x="5" y="4" width="2" height="2" fill="#22ddff" />
        <rect x="9" y="4" width="2" height="2" fill="#22ddff" />
        <rect x="5" y="7" width="6" height="1" fill="#22ddff" />
      </>);
    case "ghost":
      return (<>
        <rect x="5" y="4" width="1" height="2" fill="#fff" />
        <rect x="10" y="4" width="1" height="2" fill="#fff" />
        <rect x="7" y="6" width="2" height="1" fill="#fff" />
      </>);
    case "wink":
      return (<>
        <rect x="5" y="4" width="1" height="1" fill={c.face} />
        <rect x="10" y="5" width="1" height="1" fill={c.face} />
        <rect x="6" y="6" width="4" height="1" fill={c.face} />
      </>);
  }
}

function hat(c: CharacterDef) {
  switch (c.hatStyle) {
    case "witch": return <polygon points="4,2 12,2 8,-2" fill={c.hat} />;
    case "crown": return (<>
      <rect x="4" y="0" width="8" height="2" fill={c.hat} />
      <rect x="4" y="-1" width="1" height="1" fill={c.hat} />
      <rect x="8" y="-2" width="1" height="2" fill={c.hat} />
      <rect x="11" y="-1" width="1" height="1" fill={c.hat} />
    </>);
    case "cap": return <rect x="3" y="1" width="10" height="2" fill={c.hat} />;
    case "horn": return (<>
      <polygon points="4,2 6,2 5,-1" fill={c.hat} />
      <polygon points="10,2 12,2 11,-1" fill={c.hat} />
    </>);
    case "halo": return <ellipse cx="8" cy="1" rx="4" ry="1" fill="none" stroke={c.hat} strokeWidth="0.5" />;
    case "antenna": return (<>
      <rect x="7" y="-2" width="1" height="3" fill={c.hat} />
      <rect x="6" y="-3" width="3" height="1" fill={c.hat} />
    </>);
    case "hood": return <rect x="3" y="1" width="10" height="3" fill={c.hat} opacity="0.7" />;
    case "skull": return (<>
      <rect x="5" y="0" width="6" height="2" fill={c.hat} />
      <rect x="6" y="1" width="1" height="1" fill="#000" />
      <rect x="9" y="1" width="1" height="1" fill="#000" />
    </>);
    case "none": return null;
  }
}