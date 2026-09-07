ALTER TABLE public.youtube_uploads
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS youtube_uploads_job_id_key ON public.youtube_uploads (job_id);