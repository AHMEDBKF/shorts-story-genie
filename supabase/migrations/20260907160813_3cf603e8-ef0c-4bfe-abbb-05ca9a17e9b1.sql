ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS render_provider text,
  ADD COLUMN IF NOT EXISTS render_job_id text,
  ADD COLUMN IF NOT EXISTS render_submitted_at timestamptz;

CREATE INDEX IF NOT EXISTS videos_render_job_id_idx ON public.videos (render_job_id);