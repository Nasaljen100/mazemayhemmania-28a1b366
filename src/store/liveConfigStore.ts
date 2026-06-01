import { create } from "zustand";
import { supabase } from "../integrations/supabase/client";

export interface LiveConfig {
  version: number;
  bob?: { intros?: string[]; tips?: Record<string, string> };
  physics?: { gravity?: number; jumpVy?: number };
  xp?: { perLevel?: number };
  [k: string]: any;
}

interface Store {
  config: LiveConfig;
  loading: boolean;
  load: () => Promise<void>;
  subscribe: () => () => void;
}

export const useLiveConfigStore = create<Store>((set) => ({
  config: { version: 0 },
  loading: false,
  load: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from("live_config").select("data").eq("id", 1).maybeSingle();
    if (data?.data) set({ config: data.data as LiveConfig });
    set({ loading: false });
  },
  subscribe: () => {
    const ch = supabase
      .channel("live_config_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_config" },
        (payload: any) => {
          if (payload.new?.data) set({ config: payload.new.data });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  },
}));