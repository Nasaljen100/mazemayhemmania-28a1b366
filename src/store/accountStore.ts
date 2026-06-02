import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "../integrations/supabase/client";

export interface AccountUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  xp: number;
  xpLevel: number;
  isModerator: boolean;
  isAdmin: boolean;
}

export interface AccountProgress {
  maxUnlocked: number;
  completedLevels: number[];
  skippedLevels: number[];
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
  fetchGlobalLeaderboard: (limit?: number) => Promise<Array<{ id: string; username: string; avatarUrl: string | null; xp: number; xpLevel: number }>>;
}

function emailFor(username: string) {
  return `${username.toLowerCase().replace(/[^a-z0-9_]/g, "")}@mmm.local`;
}

function xpLevelOf(xp: number) {
  return Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1);
}

async function hydrate(userId: string) {
  const [{ data: prof }, { data: roles }, { data: prog }] = await Promise.all([
    supabase.from("profiles").select("username, avatar_url, xp").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("game_progress").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  const xp = prof?.xp ?? 0;
  const user: AccountUser = {
    id: userId,
    username: prof?.username ?? "player",
    avatarUrl: prof?.avatar_url ?? null,
    xp,
    xpLevel: xpLevelOf(xp),
    isModerator: !!roles?.some((r: any) => r.role === "moderator"),
    isAdmin: !!roles?.some((r: any) => r.role === "admin"),
  };
  const progress: AccountProgress | null = prog
    ? {
        maxUnlocked: prog.max_unlocked ?? 1,
        completedLevels: (prog.completed_levels as number[]) ?? [],
        skippedLevels: ((prog as any).skipped_levels as number[]) ?? [],
        deathsPerLevel: (prog.deaths_per_level as Record<string, number>) ?? {},
        totalDeaths: prog.total_deaths ?? 0,
      }
    : null;
  return { user, progress };
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

      startHeartbeat: () => {},
      stopHeartbeat: () => {},

      login: async (username, password) => {
        set({ loading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: emailFor(username),
            password,
          });
          if (error || !data.user) throw new Error(error?.message ?? "Login failed");
          const { user, progress } = await hydrate(data.user.id);
          set({ user, token: data.session?.access_token ?? null, progress, loading: false });
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
          const uname = username.trim();
          if (!/^[a-zA-Z0-9_]{3,20}$/.test(uname)) {
            throw new Error("Username must be 3-20 chars (letters/numbers/_)");
          }
          // Check username uniqueness (case-insensitive) up-front for a clean error.
          const { data: existing } = await supabase
            .from("profiles").select("id").ilike("username", uname).maybeSingle();
          if (existing) throw new Error("Username already taken");
          const { data, error } = await supabase.auth.signUp({
            email: emailFor(uname),
            password,
            options: { data: { username: uname } },
          });
          if (error || !data.user) throw new Error(error?.message ?? "Signup failed");
          // Wait briefly for handle_new_user trigger to materialize profile + role.
          await new Promise((r) => setTimeout(r, 400));
          const { user, progress } = await hydrate(data.user.id);
          set({ user, token: data.session?.access_token ?? null, progress, loading: false });
          return true;
        } catch (e) {
          set({ loading: false, error: (e as Error).message });
          return false;
        }
      },

      logout: async () => {
        await supabase.auth.signOut().catch(() => {});
        set({ user: null, token: null, progress: null, quests: [], friends: [] });
      },

      restoreSession: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { set({ user: null, token: null, progress: null }); return; }
        const { user, progress } = await hydrate(session.user.id);
        set({ user, token: session.access_token, progress });
        if (progress) {
          const { useGameStore } = await import("./gameStore");
          useGameStore.getState().loadProgress(progress);
        }
      },

      saveProgress: async (p) => {
        const { user } = get();
        if (!user) return;
        // XP formula: 10 per LEGITIMATELY-cleared level (skipped levels do NOT earn XP).
        const skippedSet = new Set(p.skippedLevels ?? []);
        const earned = p.completedLevels.filter((l) => !skippedSet.has(l)).length;
        const newXp = earned * 10;
        const xpGained = Math.max(0, newXp - (user.xp ?? 0));
        await supabase.from("game_progress").upsert({
          user_id: user.id,
          max_unlocked: p.maxUnlocked,
          completed_levels: p.completedLevels as any,
          skipped_levels: (p.skippedLevels ?? []) as any,
          deaths_per_level: p.deathsPerLevel as any,
          total_deaths: p.totalDeaths,
          updated_at: new Date().toISOString(),
        } as any);
        if (xpGained > 0) {
          await supabase.from("profiles").update({ xp: newXp }).eq("id", user.id);
        }
        set({
          progress: p,
          user: { ...user, xp: newXp, xpLevel: xpLevelOf(newXp) },
          ...(xpGained > 0 ? { xpBanner: { amount: xpGained, quests: [] } } : {}),
        });
      },

      uploadAvatar: async (dataUrl) => {
        const { user } = get();
        if (!user) return;
        try {
          // Convert data URL to blob
          const resp = await fetch(dataUrl);
          const blob = await resp.blob();
          const ext = (blob.type.split("/")[1] || "png").split("+")[0];
          const path = `${user.id}/avatar-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
          await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
          set({ user: { ...user, avatarUrl: pub.publicUrl } });
        } catch (e) {
          console.error("avatar upload failed", e);
        }
      },

      // Friends/quests are stubbed pending re-implementation on Cloud.
      fetchQuests: async () => {},
      fetchFriends: async () => {},
      sendFriendRequest: async () => {},
      acceptFriend: async () => {},
      searchUser: async () => [],

      spendXpToSkip: (level, cost) => {
        const { user } = get();
        if (!user) return false;
        if (user.xp < cost) return false;
        const newXp = user.xp - cost;
        set({ user: { ...user, xp: newXp, xpLevel: xpLevelOf(newXp) } });
        supabase.from("profiles").update({ xp: newXp }).eq("id", user.id).then(() => {});
        import("./gameStore").then(({ useGameStore }) => {
          const gs = useGameStore.getState();
          const newCompleted = new Set(gs.completedLevels);
          const skippedLevel = level - 1;
          newCompleted.add(skippedLevel);
          const newSkipped = new Set(gs.skippedLevels);
          newSkipped.add(skippedLevel);
          const newMax = Math.max(gs.maxUnlocked, level);
          useGameStore.setState({ completedLevels: newCompleted, skippedLevels: newSkipped, maxUnlocked: newMax });
          get().saveProgress({
            maxUnlocked: newMax,
            completedLevels: Array.from(newCompleted),
            skippedLevels: Array.from(newSkipped),
            deathsPerLevel: Object.fromEntries(Object.entries(gs.deathsPerLevel).map(([k, v]) => [k, v])),
            totalDeaths: gs.totalDeaths,
          });
        });
        return true;
      },

      fetchGlobalLeaderboard: async (limit = 100) => {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, xp")
          .order("xp", { ascending: false })
          .limit(limit);
        return (data ?? []).map((r: any) => ({
          id: r.id, username: r.username, avatarUrl: r.avatar_url,
          xp: r.xp ?? 0, xpLevel: xpLevelOf(r.xp ?? 0),
        }));
      },
    }),
    {
      name: "mmm-account",
      partialize: () => ({}),
    }
  )
);
