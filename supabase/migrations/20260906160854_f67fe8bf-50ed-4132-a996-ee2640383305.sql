
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TYPE public.job_status AS ENUM ('queued','running','paused','completed','failed','cancelled');
CREATE TYPE public.step_status AS ENUM ('pending','running','completed','failed','skipped','blocked');
CREATE TYPE public.pipeline_step AS ENUM ('pick_topic','write_story','split_scenes','generate_images','generate_voice','build_subtitles','render_video','quality_check','upload_youtube');
CREATE TYPE public.provider_capability AS ENUM ('text','image','voice','music');
CREATE TYPE public.cost_tier AS ENUM ('free','low','paid');

-- shared updated_at fn
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  low_cost_mode BOOLEAN NOT NULL DEFAULT true,
  default_language TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- CHARACTERS
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  personality TEXT,
  appearance TEXT,
  clothes TEXT,
  visual_style TEXT,
  reference_image_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.characters TO authenticated;
GRANT ALL ON public.characters TO service_role;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own characters" ON public.characters FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER characters_updated BEFORE UPDATE ON public.characters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TOPICS
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT,
  language TEXT NOT NULL DEFAULT 'ar',
  used_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own topics" ON public.topics FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- PRODUCTION JOBS
CREATE TABLE public.production_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status public.job_status NOT NULL DEFAULT 'queued',
  current_step public.pipeline_step NOT NULL DEFAULT 'pick_topic',
  request_prompt TEXT,
  language TEXT NOT NULL DEFAULT 'ar',
  low_cost_mode BOOLEAN NOT NULL DEFAULT true,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  paused_reason TEXT,
  paused_at TIMESTAMPTZ,
  last_error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_jobs TO authenticated;
GRANT ALL ON public.production_jobs TO service_role;
ALTER TABLE public.production_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own jobs" ON public.production_jobs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER jobs_updated BEFORE UPDATE ON public.production_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX jobs_pending_idx ON public.production_jobs (status, next_run_at);

-- JOB STEPS
CREATE TABLE public.job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  step public.pipeline_step NOT NULL,
  position INTEGER NOT NULL,
  status public.step_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  detail TEXT,
  output JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, step)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_steps TO authenticated;
GRANT ALL ON public.job_steps TO service_role;
ALTER TABLE public.job_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own job steps" ON public.job_steps FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER job_steps_updated BEFORE UPDATE ON public.job_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STORIES
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  hook TEXT,
  body TEXT NOT NULL,
  lesson TEXT,
  ending TEXT,
  language TEXT NOT NULL DEFAULT 'ar',
  estimated_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stories" ON public.stories FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- SCENES
CREATE TABLE public.scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  description TEXT,
  characters JSONB NOT NULL DEFAULT '[]'::jsonb,
  dialogue TEXT,
  narration TEXT,
  image_prompt TEXT,
  animation TEXT,
  sound_effects TEXT,
  duration_seconds NUMERIC NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, scene_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenes TO authenticated;
GRANT ALL ON public.scenes TO service_role;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scenes" ON public.scenes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- IMAGES
CREATE TABLE public.generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  provider TEXT,
  prompt TEXT,
  storage_path TEXT,
  public_url TEXT,
  width INTEGER NOT NULL DEFAULT 1080,
  height INTEGER NOT NULL DEFAULT 1920,
  is_mock BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scene_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_images TO authenticated;
GRANT ALL ON public.generated_images TO service_role;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own images" ON public.generated_images FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AUDIO
CREATE TABLE public.audio_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'narration',
  provider TEXT,
  voice TEXT,
  text TEXT,
  storage_path TEXT,
  public_url TEXT,
  duration_seconds NUMERIC,
  is_mock BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, scene_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audio_files TO authenticated;
GRANT ALL ON public.audio_files TO service_role;
ALTER TABLE public.audio_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audio" ON public.audio_files FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- VIDEOS
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  subtitles_vtt TEXT,
  storage_path TEXT,
  public_url TEXT,
  width INTEGER NOT NULL DEFAULT 1080,
  height INTEGER NOT NULL DEFAULT 1920,
  duration_seconds NUMERIC,
  render_status TEXT NOT NULL DEFAULT 'pending',
  quality_report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own videos" ON public.videos FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER videos_updated BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FAILED JOBS
CREATE TABLE public.failed_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  step public.pipeline_step,
  error TEXT NOT NULL,
  status_code INTEGER,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.failed_jobs TO authenticated;
GRANT ALL ON public.failed_jobs TO service_role;
ALTER TABLE public.failed_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own failures" ON public.failed_jobs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- AI PROVIDERS
CREATE TABLE public.ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  capability public.provider_capability NOT NULL,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  cost_tier public.cost_tier NOT NULL DEFAULT 'free',
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'ready',
  last_error TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, capability, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own providers" ON public.ai_providers FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER providers_updated BEFORE UPDATE ON public.ai_providers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- YOUTUBE ACCOUNTS (server-only: no grants to authenticated)
CREATE TABLE public.youtube_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  channel_id TEXT,
  channel_title TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.youtube_accounts TO service_role;
ALTER TABLE public.youtube_accounts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER yt_updated BEFORE UPDATE ON public.youtube_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- YOUTUBE UPLOADS
CREATE TABLE public.youtube_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  youtube_video_id TEXT,
  privacy_status TEXT NOT NULL DEFAULT 'private',
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_uploads TO authenticated;
GRANT ALL ON public.youtube_uploads TO service_role;
ALTER TABLE public.youtube_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own uploads" ON public.youtube_uploads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER yt_uploads_updated BEFORE UPDATE ON public.youtube_uploads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUTOMATION SCHEDULES
CREATE TABLE public.automation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  cadence TEXT NOT NULL DEFAULT 'weekly',
  day_of_week INTEGER NOT NULL DEFAULT 1,
  hour_utc INTEGER NOT NULL DEFAULT 6,
  privacy_status TEXT NOT NULL DEFAULT 'private',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_schedules TO authenticated;
GRANT ALL ON public.automation_schedules TO service_role;
ALTER TABLE public.automation_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own schedule" ON public.automation_schedules FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER schedules_updated BEFORE UPDATE ON public.automation_schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- JOB LOCKS (server-only)
CREATE TABLE public.job_locks (
  key TEXT PRIMARY KEY,
  holder TEXT,
  locked_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.job_locks TO service_role;
ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;

-- SEED ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  INSERT INTO public.automation_schedules (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  INSERT INTO public.topics (user_id, title, slug, category)
  SELECT NEW.id, t.title, t.slug, t.category FROM (VALUES
    ('الصدق','honesty','قيم'),
    ('المشاركة','sharing','قيم'),
    ('النظافة','cleanliness','عادات'),
    ('الأرقام','numbers','تعليم'),
    ('الألوان','colors','تعليم'),
    ('الحيوانات','animals','تعليم'),
    ('الحروف','alphabet','تعليم'),
    ('الصداقة','friendship','قيم'),
    ('السلامة','safety','عادات'),
    ('الاحترام','respect','قيم'),
    ('العادات الحسنة','good-habits','عادات'),
    ('التعاون','teamwork','قيم'),
    ('الصبر','patience','قيم'),
    ('شكر الوالدين','gratitude-parents','قيم')
  ) AS t(title, slug, category)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.ai_providers (user_id, capability, key, label, cost_tier, priority, enabled)
  SELECT NEW.id, p.capability::public.provider_capability, p.key, p.label, p.tier::public.cost_tier, p.priority, true
  FROM (VALUES
    ('text','mock-text','مولّد نصوص تجريبي','free',10),
    ('image','mock-image','مولّد صور تجريبي','free',10),
    ('voice','mock-voice','مولّد صوت تجريبي','free',10),
    ('music','mock-music','موسيقى تجريبية','free',10)
  ) AS p(capability, key, label, tier, priority)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
