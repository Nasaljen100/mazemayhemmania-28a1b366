
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('user', 'moderator', 'admin');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_url text,
  xp integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read_all_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Progress
CREATE TABLE public.game_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  max_unlocked integer NOT NULL DEFAULT 1,
  completed_levels jsonb NOT NULL DEFAULT '[]'::jsonb,
  deaths_per_level jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_deaths integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.game_progress TO authenticated;
GRANT ALL ON public.game_progress TO service_role;
ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_read_own" ON public.game_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "progress_insert_own" ON public.game_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "progress_update_own" ON public.game_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Live config singleton (BOB personality, physics tweaks, etc.)
CREATE TABLE public.live_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.live_config (id, data) VALUES (1, '{}'::jsonb);
GRANT SELECT ON public.live_config TO anon, authenticated;
GRANT UPDATE ON public.live_config TO authenticated;
GRANT ALL ON public.live_config TO service_role;
ALTER TABLE public.live_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_read_all" ON public.live_config FOR SELECT USING (true);
CREATE POLICY "config_mod_update" ON public.live_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

-- AI-generated level overrides
CREATE TABLE public.ai_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_number integer NOT NULL,
  definition jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_levels_num_idx ON public.ai_levels(level_number);
GRANT SELECT ON public.ai_levels TO anon, authenticated;
GRANT INSERT ON public.ai_levels TO authenticated;
GRANT ALL ON public.ai_levels TO service_role;
ALTER TABLE public.ai_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ailevels_read_all" ON public.ai_levels FOR SELECT USING (true);
CREATE POLICY "ailevels_mod_insert" ON public.ai_levels FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

-- Broadcasts (for "New update" freeze events)
CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.broadcasts TO anon, authenticated;
GRANT INSERT ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bcast_read_all" ON public.broadcasts FOR SELECT USING (true);
CREATE POLICY "bcast_mod_insert" ON public.broadcasts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;

-- John chat messages
CREATE TABLE public.john_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX john_messages_user_idx ON public.john_messages(user_id, created_at);
GRANT SELECT, INSERT ON public.john_messages TO authenticated;
GRANT ALL ON public.john_messages TO service_role;
ALTER TABLE public.john_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "john_read_own_or_mod" ON public.john_messages FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "john_insert_own_mod" ON public.john_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin')));

-- Trigger: create profile + assign role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uname text;
  is_mod boolean;
BEGIN
  uname := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  is_mod := lower(uname) IN ('nasalion100', 'adv');
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (NEW.id, uname, NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  IF is_mod THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'moderator') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for avatars + John uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('john', 'john', true) ON CONFLICT DO NOTHING;
CREATE POLICY "avatars_read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "john_read" ON storage.objects FOR SELECT USING (bucket_id = 'john');
CREATE POLICY "john_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'john');
