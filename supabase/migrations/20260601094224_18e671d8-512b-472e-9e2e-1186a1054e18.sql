
-- 1. Replace handle_new_user with new moderator usernames
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uname text;
  is_mod boolean;
BEGIN
  uname := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  is_mod := lower(uname) IN ('nasaljen100', 'adv');
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (NEW.id, uname, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  IF is_mod THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'moderator') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Fix existing data: grant moderator to users named nasaljen100 / adv, revoke from others
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'moderator'::app_role FROM public.profiles p
WHERE lower(p.username) IN ('nasaljen100','adv')
ON CONFLICT DO NOTHING;

DELETE FROM public.user_roles ur
WHERE ur.role = 'moderator'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = ur.user_id AND lower(p.username) IN ('nasaljen100','adv')
  );

-- 3. Enable realtime publication for broadcasts and live_config
ALTER TABLE public.broadcasts REPLICA IDENTITY FULL;
ALTER TABLE public.live_config REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='broadcasts';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='live_config';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.live_config; END IF;
END $$;

-- 4. Seed default live_config row
INSERT INTO public.live_config (id, data) VALUES (1, '{"version":1,"bob":{},"physics":{},"xp":{}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 5. Multiplayer lobbies
CREATE TABLE public.lobbies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_id uuid NOT NULL,
  current_level int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lobbies TO authenticated;
GRANT ALL ON public.lobbies TO service_role;
ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lobbies_read_all" ON public.lobbies FOR SELECT TO authenticated USING (true);
CREATE POLICY "lobbies_insert_auth" ON public.lobbies FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "lobbies_update_host" ON public.lobbies FOR UPDATE TO authenticated USING (auth.uid() = host_id);
CREATE POLICY "lobbies_delete_host" ON public.lobbies FOR DELETE TO authenticated USING (auth.uid() = host_id);

CREATE TABLE public.lobby_players (
  lobby_id uuid NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  username text NOT NULL,
  color_index int NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lobby_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lobby_players TO authenticated;
GRANT ALL ON public.lobby_players TO service_role;
ALTER TABLE public.lobby_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lp_read_all" ON public.lobby_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "lp_insert_self" ON public.lobby_players FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lp_delete_self" ON public.lobby_players FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.lobbies REPLICA IDENTITY FULL;
ALTER TABLE public.lobby_players REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='lobbies';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='lobby_players';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_players; END IF;
END $$;
