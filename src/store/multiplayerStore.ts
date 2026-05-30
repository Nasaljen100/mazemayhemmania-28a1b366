import { create } from "zustand";
import { PLAYER_COLORS } from "../game/gameConfig";

export interface RemotePlayer {
  userId: number;
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
  ws: WebSocket | null;
  lobbyId: string | null;
  currentLevel: number;
  myColorIndex: number;
  remotePlayers: RemotePlayer[];
  connected: boolean;
  error: string | null;
  levelAdvanceCallback: ((nextLevel: number) => void) | null;

  connect: (token: string) => void;
  disconnect: () => void;
  createAndJoinLobby: (token: string) => Promise<string | null>;
  joinLobby: (lobbyId: string) => void;
  leaveLobby: () => void;
  sendPlayerState: (state: { x: number; y: number; facingRight: boolean; onGround: boolean; dead: boolean; level: number }) => void;
  sendLevelAdvance: (nextLevel: number) => void;
  setLevelAdvanceCallback: (cb: ((nextLevel: number) => void) | null) => void;
  setError: (e: string | null) => void;
}

import { API_BASE as BASE, wsUrl } from "../lib/gameApi";

function wsUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/ws`;
}

export const useMultiplayerStore = create<MultiplayerStore>((set, get) => ({
  ws: null,
  lobbyId: null,
  currentLevel: 1,
  myColorIndex: 0,
  remotePlayers: [],
  connected: false,
  error: null,
  levelAdvanceCallback: null,

  setError: (error) => set({ error }),
  setLevelAdvanceCallback: (cb) => set({ levelAdvanceCallback: cb }),

  connect: (token: string) => {
    const existing = get().ws;
    if (existing && existing.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(wsUrl());

    ws.onopen = () => {
      set({ connected: true, error: null });
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(ev.data); } catch { return; }

      const type = msg.type as string;

      if (type === "authed") {
        set({ connected: true });
      }
      else if (type === "joined") {
        set({
          lobbyId: msg.lobbyId as string,
          currentLevel: (msg.currentLevel as number) ?? 1,
          myColorIndex: (msg.colorIndex as number) ?? 0,
          remotePlayers: [],
        });
      }
      else if (type === "left") {
        set({ lobbyId: null, remotePlayers: [], currentLevel: 1 });
      }
      else if (type === "lobby_state") {
        const players = (msg.players as RemotePlayer[]) ?? [];
        const { ws: currentWs } = get();
        // Filter out self (we identify by colorIndex set at join)
        set({ remotePlayers: players });
      }
      else if (type === "player_state") {
        const update = msg as unknown as RemotePlayer;
        set(s => ({
          remotePlayers: s.remotePlayers.some(p => p.userId === update.userId)
            ? s.remotePlayers.map(p => p.userId === update.userId ? { ...p, ...update } : p)
            : [...s.remotePlayers, update],
        }));
      }
      else if (type === "player_joined") {
        // Will get a lobby_state broadcast
      }
      else if (type === "player_left") {
        const userId = msg.userId as number;
        set(s => ({ remotePlayers: s.remotePlayers.filter(p => p.userId !== userId) }));
      }
      else if (type === "level_advance") {
        const nextLevel = msg.nextLevel as number;
        set({ currentLevel: nextLevel });
        const cb = get().levelAdvanceCallback;
        if (cb) cb(nextLevel);
      }
      else if (type === "error") {
        set({ error: msg.message as string });
      }
    };

    ws.onclose = () => {
      set({ connected: false, ws: null, lobbyId: null, remotePlayers: [] });
    };

    ws.onerror = () => {
      set({ error: "Connection failed", connected: false });
    };

    set({ ws });
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) ws.close();
    set({ ws: null, connected: false, lobbyId: null, remotePlayers: [], currentLevel: 1 });
  },

  createAndJoinLobby: async (token: string) => {
    try {
      const r = await fetch(`${BASE}/lobbies/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token },
      });
      const data = await r.json();
      if (!r.ok) { set({ error: data.error }); return null; }
      const lobbyId = data.lobbyId as string;
      get().joinLobby(lobbyId);
      return lobbyId;
    } catch {
      set({ error: "Failed to create lobby" });
      return null;
    }
  },

  joinLobby: (lobbyId: string) => {
    const { ws } = get();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      set({ error: "Not connected" }); return;
    }
    ws.send(JSON.stringify({ type: "join_lobby", lobbyId }));
  },

  leaveLobby: () => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "leave_lobby" }));
    }
    set({ lobbyId: null, remotePlayers: [], currentLevel: 1 });
  },

  sendPlayerState: (state) => {
    const { ws, lobbyId } = get();
    if (!ws || ws.readyState !== WebSocket.OPEN || !lobbyId) return;
    ws.send(JSON.stringify({ type: "player_state", ...state }));
  },

  sendLevelAdvance: (nextLevel: number) => {
    const { ws, lobbyId } = get();
    if (!ws || ws.readyState !== WebSocket.OPEN || !lobbyId) return;
    ws.send(JSON.stringify({ type: "level_advance", nextLevel }));
    set({ currentLevel: nextLevel });
  },
}));
