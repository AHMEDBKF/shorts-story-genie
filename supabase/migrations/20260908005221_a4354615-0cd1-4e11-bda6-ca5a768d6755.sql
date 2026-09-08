ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.production_jobs ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;