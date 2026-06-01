import { create } from "zustand";
import { supabase } from "../integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface RemotePlayer {
  userId: string;
  username: string;
  colorIndex: number;
  x: number;
  y: number;
  facingRight: boolean;
  onGround: boolean;
  dead: boolean;
  level: number;
}

export interface MultiplayerStore {
  ws: null;
  channel: RealtimeChannel | null;
  lobbyId: string | null;
  lobbyDbId: string | null;
  selfUserId: string | null;
  selfUsername: string | null;
  currentLevel: number;
  myColorIndex: number;
  remotePlayers: RemotePlayer[];
  connected: boolean;
  error: string | null;
  levelAdvanceCallback: ((nextLevel: number) => void) | null;

  connect: (token: string) => void;
  disconnect: () => void;
  createAndJoinLobby: (token: string) => Promise<string | null>;
  joinLobby: (lobbyId: string) => Promise<void>;
  leaveLobby: () => void;
  sendPlayerState: (state: { x: number; y: number; facingRight: boolean; onGround: boolean; dead: boolean; level: number }) => void;
  sendLevelAdvance: (nextLevel: number) => void;
  setLevelAdvanceCallback: (cb: ((nextLevel: number) => void) | null) => void;
  setError: (e: string | null) => void;
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  ws: null,
  channel: null,
  lobbyId: null,
  lobbyDbId: null,
  selfUserId: null,
  selfUsername: null,
  currentLevel: 1,
  myColorIndex: 0,
  remotePlayers: [],
  connected: false,
  error: null,
  levelAdvanceCallback: null,

  setError: (error) => set({ error }),
  setLevelAdvanceCallback: (cb) => set({ levelAdvanceCallback: cb }),

  connect: () => { set({ connected: true, error: null }); },

  disconnect: () => {
    const { channel } = get();
    if (channel) supabase.removeChannel(channel);
    set({ channel: null, connected: false, lobbyId: null, lobbyDbId: null, remotePlayers: [], currentLevel: 1 });
  },

  createAndJoinLobby: async () => {
    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    if (!user) { set({ error: "Not signed in" }); return null; }
    const code = makeCode();
    const { data: lobby, error } = await supabase
      .from("lobbies")
      .insert({ code, host_id: user.id, current_level: 1 })
      .select().single();
    if (error || !lobby) { set({ error: error?.message ?? "Failed to create lobby" }); return null; }
    await get().joinLobby(code);
    return code;
  },

  joinLobby: async (code: string) => {
    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    if (!user) { set({ error: "Not signed in" }); return; }
    const { data: prof } = await supabase
      .from("profiles").select("username").eq("id", user.id).maybeSingle();
    const username = prof?.username ?? "player";

    const { data: lobby, error } = await supabase
      .from("lobbies").select("*").eq("code", code).maybeSingle();
    if (error || !lobby) { set({ error: "Lobby not found" }); return; }

    const { data: existing } = await supabase
      .from("lobby_players").select("color_index").eq("lobby_id", lobby.id);
    const used = new Set((existing ?? []).map((p: any) => p.color_index));
    let colorIndex = 0;
    while (used.has(colorIndex)) colorIndex++;

    await supabase.from("lobby_players").upsert({
      lobby_id: lobby.id, user_id: user.id, username, color_index: colorIndex,
    }, { onConflict: "lobby_id,user_id" });

    const prev = get().channel;
    if (prev) supabase.removeChannel(prev);

    const ch = supabase.channel(`lobby:${lobby.id}`, {
      config: { broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "player_state" }, (p: any) => {
      const update = p.payload as RemotePlayer;
      if (!update?.userId || update.userId === user.id) return;
      set(s => ({
        remotePlayers: s.remotePlayers.some(rp => rp.userId === update.userId)
          ? s.remotePlayers.map(rp => rp.userId === update.userId ? { ...rp, ...update } : rp)
          : [...s.remotePlayers, update],
      }));
    });
    ch.on("broadcast", { event: "level_advance" }, (p: any) => {
      const next = p.payload?.nextLevel as number;
      if (!next) return;
      set({ currentLevel: next });
      const cb = get().levelAdvanceCallback;
      if (cb) cb(next);
    });
    ch.on("broadcast", { event: "player_left" }, (p: any) => {
      const uid = p.payload?.userId as string;
      set(s => ({ remotePlayers: s.remotePlayers.filter(rp => rp.userId !== uid) }));
    });

    await ch.subscribe();

    const { data: peers } = await supabase
      .from("lobby_players").select("*").eq("lobby_id", lobby.id);
    const remote: RemotePlayer[] = (peers ?? [])
      .filter((p: any) => p.user_id !== user.id)
      .map((p: any) => ({
        userId: p.user_id, username: p.username, colorIndex: p.color_index,
        x: 0, y: 0, facingRight: true, onGround: false, dead: false, level: lobby.current_level,
      }));

    set({
      channel: ch,
      lobbyId: code,
      lobbyDbId: lobby.id,
      currentLevel: lobby.current_level,
      myColorIndex: colorIndex,
      remotePlayers: remote,
      selfUserId: user.id,
      selfUsername: username,
      connected: true,
      error: null,
    });
  },

  leaveLobby: () => {
    const { channel, lobbyDbId, selfUserId } = get();
    if (channel && selfUserId) {
      try { channel.send({ type: "broadcast", event: "player_left", payload: { userId: selfUserId } }); } catch { /* ignore */ }
      supabase.removeChannel(channel);
    }
    if (lobbyDbId && selfUserId) {
      supabase.from("lobby_players").delete()
        .eq("lobby_id", lobbyDbId).eq("user_id", selfUserId).then(() => {});
    }
    set({ channel: null, lobbyId: null, lobbyDbId: null, remotePlayers: [], currentLevel: 1 });
  },

  sendPlayerState: (state) => {
    const { channel, selfUserId, selfUsername, myColorIndex } = get();
    if (!channel || !selfUserId) return;
    channel.send({
      type: "broadcast", event: "player_state",
      payload: { userId: selfUserId, username: selfUsername, colorIndex: myColorIndex, ...state },
    });
  },

  sendLevelAdvance: (nextLevel: number) => {
    const { channel, lobbyDbId } = get();
    if (!channel) return;
    channel.send({ type: "broadcast", event: "level_advance", payload: { nextLevel } });
    if (lobbyDbId) supabase.from("lobbies").update({ current_level: nextLevel }).eq("id", lobbyDbId).then(() => {});
    set({ currentLevel: nextLevel });
  },
}));