
-- ============ CHARACTERS / INVENTORY ============
CREATE TABLE public.user_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  character_id integer NOT NULL, -- 1..100
  xp integer NOT NULL DEFAULT 0,
  upgrade_level integer NOT NULL DEFAULT 0,
  equipped boolean NOT NULL DEFAULT false,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, character_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_characters TO authenticated;
GRANT SELECT ON public.user_characters TO anon;
GRANT ALL ON public.user_characters TO service_role;
ALTER TABLE public.user_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY uc_read_all ON public.user_characters FOR SELECT USING (true);
CREATE POLICY uc_insert_own ON public.user_characters FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY uc_update_own ON public.user_characters FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY uc_delete_own ON public.user_characters FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY uc_mod_all ON public.user_characters FOR ALL TO authenticated
  USING (has_role(auth.uid(),'moderator') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'moderator') OR has_role(auth.uid(),'admin'));

-- ============ SHOP STOCK (rotating 20 slots) ============
CREATE TABLE public.shop_stock (
  id integer PRIMARY KEY DEFAULT 1,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{character_id, price, rarity}]
  restocked_at timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
GRANT SELECT ON public.shop_stock TO anon, authenticated;
GRANT ALL ON public.shop_stock TO service_role;
ALTER TABLE public.shop_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY ss_read ON public.shop_stock FOR SELECT USING (true);
CREATE POLICY ss_mod_update ON public.shop_stock FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'moderator') OR has_role(auth.uid(),'admin'));
INSERT INTO public.shop_stock (id, slots) VALUES (1, '[]'::jsonb);

-- ============ BADGES ============
CREATE TABLE public.badges (
  id integer PRIMARY KEY,
  name text NOT NULL,
  rarity text NOT NULL, -- common/uncommon/rare/epic/legendary/mythic/moderator
  icon text NOT NULL,   -- emoji or short string
  description text NOT NULL DEFAULT '',
  obtainable boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY badges_read ON public.badges FOR SELECT USING (true);

INSERT INTO public.badges (id, name, rarity, icon, description, obtainable) VALUES
  (1,'Newcomer','common','🌱','Joined the game',true),
  (2,'Survivor','common','🛡️','Beat 10 levels',true),
  (3,'Speedrunner','uncommon','⚡','Beat 50 levels',true),
  (4,'Veteran','rare','🎖️','Beat 200 levels',true),
  (5,'Mazemaster','epic','👑','Beat 500 levels',true),
  (6,'Legend','legendary','🌟','Beat all 628 levels',true),
  (7,'Lucky','rare','🍀','Open 10 boxes',true),
  (8,'Collector','epic','💎','Own 50 characters',true),
  (9,'Mythic Hunter','mythic','🔥','Own a mythic character',true),
  (10,'MODERATOR','moderator','🛠️','Official moderator',false);

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id integer NOT NULL REFERENCES public.badges(id),
  equipped boolean NOT NULL DEFAULT false,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_badges TO authenticated;
GRANT SELECT ON public.user_badges TO anon;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY ub_read_all ON public.user_badges FOR SELECT USING (true);
CREATE POLICY ub_insert_own ON public.user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY ub_update_own ON public.user_badges FOR UPDATE TO authenticated USING (auth.uid()=user_id);
CREATE POLICY ub_mod_all ON public.user_badges FOR ALL TO authenticated
  USING (has_role(auth.uid(),'moderator') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'moderator') OR has_role(auth.uid(),'admin'));

-- Auto-grant the moderator badge to mods on signup
CREATE OR REPLACE FUNCTION public.grant_mod_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'moderator' OR NEW.role = 'admin' THEN
    INSERT INTO public.user_badges (user_id, badge_id, equipped)
    VALUES (NEW.user_id, 10, true)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_grant_mod_badge AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.grant_mod_badge();

-- Backfill existing mods
INSERT INTO public.user_badges (user_id, badge_id, equipped)
SELECT user_id, 10, true FROM public.user_roles
WHERE role IN ('moderator','admin')
ON CONFLICT DO NOTHING;

-- ============ STORAGE: secure john bucket ============
DROP POLICY IF EXISTS "john_write" ON storage.objects;
DROP POLICY IF EXISTS john_write ON storage.objects;
CREATE POLICY "john_write_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'john' AND (auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "john_update_own_folder" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'john' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- ============ REALTIME: restrict channels ============
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rt_auth_read ON realtime.messages;
DROP POLICY IF EXISTS rt_auth_write ON realtime.messages;
CREATE POLICY rt_auth_read ON realtime.messages FOR SELECT TO authenticated
  USING (
    -- public lobby/game channels OK for any authenticated user; mod channels require role
    NOT (extension = 'broadcast' AND topic LIKE 'mod:%')
    OR has_role(auth.uid(),'moderator') OR has_role(auth.uid(),'admin')
  );
CREATE POLICY rt_auth_write ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    NOT (extension = 'broadcast' AND topic LIKE 'mod:%')
    OR has_role(auth.uid(),'moderator') OR has_role(auth.uid(),'admin')
  );
