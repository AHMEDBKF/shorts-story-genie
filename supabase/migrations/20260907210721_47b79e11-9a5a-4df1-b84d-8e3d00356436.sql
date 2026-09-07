ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS render_provider text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS allow_paid_renderer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ffmpeg_worker_url text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_render_provider_check
  CHECK (render_provider IN ('auto', 'shotstack', 'ffmpeg'));