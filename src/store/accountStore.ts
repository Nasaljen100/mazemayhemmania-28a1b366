import { create } from "zustand";
import { persist } from "zustand/middleware";

import { API_BASE as BASE, wsUrl } from "../lib/gameApi";

export interface AccountUser {
  id: number;
  username: string;
  avatarUrl: string | null;
  xp: number;
  xpLevel: number;
}

export interface AccountProgress {
  maxUnlocked: number;
  completedLevels: number[];
  deathsPerLevel: Record<string, number>;
  totalDeaths: number;
}

export interface QuestDef {
  id: string;
  title: string;
  desc: string;
  xp: number;
  target: number;
  type: string;
  completed: boolean;
  completedAt: string | null;
}

export interface Friend {
  id: number;
  friendId: number;
  username: string | null;
  avatarUrl: string | null;
  xp: number | null;
  xpLevel: number | null;
  status: string;
}

export interface AccountStore {
  user: AccountUser | null;
  token: string | null;
  progress: AccountProgress | null;
  quests: QuestDef[];
  friends: Friend[];
  incomingRequests: { id: number; userId: number; username: string | null }[];
  xpBanner: { amount: number; quests: string[] } | null;
  loading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  saveProgress: (p: AccountProgress) => Promise<void>;
  uploadAvatar: (dataUrl: string) => Promise<void>;
  fetchQuests: () => Promise<void>;
  fetchFriends: () => Promise<void>;
  sendFriendRequest: (friendId: number) => Promise<void>;
  acceptFriend: (friendId: number) => Promise<void>;
  searchUser: (q: string) => Promise<AccountUser[]>;
  spendXpToSkip: (level: number, cost: number) => boolean;
  dismissXpBanner: () => void;
  setError: (e: string | null) => void;
  startHeartbeat: (token: string) => void;
  stopHeartbeat: () => void;
}

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

async function api(path: string, method = "GET", body?: unknown, token?: string) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-session-token": token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

async function beat(token: string) {
  try {
    await fetch(`${BASE}/online/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-session-token": token },
    });
  } catch {}
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      progress: null,
      quests: [],
      friends: [],
      incomingRequests: [],
      xpBanner: null,
      loading: false,
      error: null,

      setError: (error) => set({ error }),
      dismissXpBanner: () => set({ xpBanner: null }),

      startHeartbeat: (token: string) => {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        beat(token);
        heartbeatInterval = setInterval(() => beat(token), 30000);
      },

      stopHeartbeat: () => {
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
      },

      login: async (username, password) => {
        set({ loading: true, error: null });
        try {
          const data = await api("/auth/login", "POST", { username, password });
          const progress: AccountProgress | null = data.progress ? {
            maxUnlocked: data.progress.max_unlocked ?? data.progress.maxUnlocked ?? 1,
            completedLevels: data.progress.completed_levels ?? data.progress.completedLevels ?? [],
            deathsPerLevel: data.progress.deaths_per_level ?? data.progress.deathsPerLevel ?? {},
            totalDeaths: data.progress.total_deaths ?? data.progress.totalDeaths ?? 0,
          } : null;
          set({ user: data.user, token: data.token, progress, loading: false });
          if (progress) {
            const { useGameStore } = await import("./gameStore");
            useGameStore.getState().loadProgress(progress);
          }
          return true;
        } catch (e) {
          set({ loading: false, error: (e as Error).message });
          return false;
        }
      },

      register: async (username, password) => {
        set({ loading: true, error: null });
        try {
          const data = await api("/auth/register", "POST", { username, password });
          set({ user: data.user, token: data.token, progress: null, loading: false });
          return true;
        } catch (e) {
          set({ loading: false, error: (e as Error).message });
          return false;
        }
      },

      logout: async () => {
        const { token } = get();
        get().stopHeartbeat();
        if (token) await api("/auth/logout", "POST", {}, token).catch(() => {});
        set({ user: null, token: null, progress: null, quests: [], friends: [] });
      },

      restoreSession: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const data = await api("/auth/me", "GET", undefined, token);
          const progress: AccountProgress | null = data.progress ? {
            maxUnlocked: data.progress.maxUnlocked ?? data.progress.max_unlocked ?? 1,
            completedLevels: data.progress.completedLevels ?? data.progress.completed_levels ?? [],
            deathsPerLevel: data.progress.deathsPerLevel ?? data.progress.deaths_per_level ?? {},
            totalDeaths: data.progress.totalDeaths ?? data.progress.total_deaths ?? 0,
          } : null;
          set({ user: data.user, progress });
          if (progress) {
            const { useGameStore } = await import("./gameStore");
            useGameStore.getState().loadProgress(progress);
          }
        } catch {
          set({ token: null, user: null, progress: null });
        }
      },

      saveProgress: async (p) => {
        const { token } = get();
        if (!token) return;
        try {
          const data = await api("/progress/save", "POST", {
            maxUnlocked: p.maxUnlocked,
            completedLevels: p.completedLevels,
            deathsPerLevel: p.deathsPerLevel,
            totalDeaths: p.totalDeaths,
          }, token);
          set({ progress: p });
          if (data.xpGained > 0) {
            set({
              user: get().user ? { ...get().user!, xp: data.newXp, xpLevel: data.newXpLevel } : null,
              xpBanner: { amount: data.xpGained, quests: data.newlyCompleted ?? [] },
            });
          }
        } catch {}
      },

      uploadAvatar: async (dataUrl) => {
        const { token } = get();
        if (!token) return;
        await api("/auth/avatar", "POST", { avatarUrl: dataUrl }, token);
        set({ user: get().user ? { ...get().user!, avatarUrl: dataUrl } : null });
      },

      fetchQuests: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const data = await api("/quests", "GET", undefined, token);
          set({ quests: data.quests });
        } catch {}
      },

      fetchFriends: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const data = await api("/friends", "GET", undefined, token);
          set({ friends: data.friends ?? [], incomingRequests: data.incoming ?? [] });
        } catch {}
      },

      sendFriendRequest: async (friendId) => {
        const { token } = get();
        if (!token) return;
        await api("/friends/request", "POST", { friendId }, token);
      },

      acceptFriend: async (friendId) => {
        const { token } = get();
        if (!token) return;
        await api("/friends/accept", "POST", { friendId }, token);
        await get().fetchFriends();
      },

      searchUser: async (q) => {
        const { token } = get();
        if (!token) return [];
        try {
          const data = await api(`/users/search?q=${encodeURIComponent(q)}`, "GET", undefined, token);
          return data.users ?? [];
        } catch {
          return [];
        }
      },
    }),
    {
      name: "level-hinter-account",
      partialize: (s) => ({ token: s.token }),
    }
  )
);
