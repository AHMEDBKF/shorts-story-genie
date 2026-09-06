# Kids Shorts AI — Phase 1

An Arabic-first app that turns one button click into a finished children's Short, step by step, in the background. Phase 1 builds the whole machine end-to-end with placeholder AI, so you can watch a video move through every stage. Real AI providers and the final video file get plugged in afterwards.

## What you'll be able to do

- Sign in with your own account; everything you create stays private to you.
- Open a dashboard in Arabic with one big button: **إنشاء فيديو هذا الأسبوع**.
- Optionally type a request instead, e.g. "قصة قصيرة للأطفال عن الصدق".
- Close the browser. Work continues on its own and picks up where it left off.
- Come back and see progress: topic chosen → story written → scenes split → images → voices → subtitles → checks → upload.
- Keep a character library (name, personality, looks, clothes, style, reference image) so the same cast appears across videos.
- Connect your YouTube channel and have finished videos uploaded as **Private** by default.
- Turn on a weekly schedule so a new Short starts by itself.
- A **Low Cost Mode** switch that keeps the app on free/open tools and makes jobs wait for free quota rather than fail. No paid provider is ever used unless you explicitly enable it.

## How the automation works

Each click creates a production job saved in the database. A background worker runs one small step at a time, saves the result, and stops. A scheduled trigger wakes it again a moment later, so a long production simply continues over hours or days without the browser being open.

Safety rules built in from the start: one worker at a time per job, a limited amount of work per wake-up, each finished step recorded so nothing is redone, automatic retry of a failed step, and the whole job pausing itself (with a clear message on the dashboard) if an AI provider runs out of credit or blocks the request.

## Phase 1 boundaries

- AI text, images, voice and music run through a provider layer that currently returns realistic placeholder content. Swapping in real providers later is a settings change, not a rebuild.
- The final MP4 assembly is left as a clearly marked pending step, because video stitching needs a machine this app doesn't have. Everything up to it — images, audio, subtitles, quality checks, YouTube metadata — is real and stored.
- YouTube connection and upload are fully wired; the upload waits for a finished video file.

## Screens

- **لوحة التحكم** — the big create button, current job progress with a step-by-step timeline, pending tasks, completed videos, failed tasks, provider status, YouTube status.
- **الشخصيات** — character library, create/edit.
- **الفيديوهات** — list of productions; open one to see its story, scenes, images, narration, subtitles.
- **الإعدادات** — Low Cost Mode, provider list and status, weekly schedule, YouTube channel connect/disconnect.
- **تسجيل الدخول** — email + password.

Visual direction: warm, playful, rounded children's-app look, right-to-left Arabic layout, friendly display typeface — not a generic dashboard.

## Technical section

Backend: Lovable Cloud (Postgres + auth + storage + secrets).

Tables (all RLS-protected, owner-scoped, with explicit grants): `profiles`, `user_roles`, `characters`, `topics`, `stories`, `scenes`, `generated_images`, `audio_files`, `videos`, `production_jobs`, `job_steps`, `failed_jobs`, `ai_providers`, `youtube_accounts`, `youtube_uploads`, `automation_schedules`, `job_locks`. Storage buckets: `scene-images`, `audio`, `renders`, `character-refs` (private, signed URLs).

Pipeline steps stored as an ordered enum on `job_steps`: `pick_topic`, `write_story`, `split_scenes`, `generate_images`, `generate_voice`, `build_subtitles`, `render_video` (stubbed), `quality_check`, `upload_youtube`. Per-item work (images, voices) is queued per scene with a unique key on scene+operation for idempotency.

Runtime: TanStack Start. `createServerFn` for dashboard actions and reads; `src/routes/api/public/worker-tick.ts` as the scheduler-callable worker entry (shared-secret header check), driven by pg_cron. Worker contract: acquire lease row in `job_locks` with expiry → exit if held; read paused state and exit while paused (one probe item allowed); bounded batch per tick; mark each item done in the same transaction; halt job on 402/403 and park on repeated 429s per the gateway error contract.

Provider layer: `src/lib/providers/*` with `text`, `image`, `voice`, `music` interfaces, a router with per-capability ordering, fallback chain, and a `mock` implementation registered for all four in Phase 1. Real adapters (Lovable AI Gateway for text/image, a TTS provider for Arabic voice) land behind the same interfaces. Cost tier is recorded per provider; Low Cost Mode filters to `free` tier only.

YouTube: OAuth code flow via `src/routes/api/public/youtube/callback.ts`; refresh token stored server-side only, never returned to the client. Upload defaults to `privacyStatus: private`.

Secrets (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `WORKER_SECRET`) stay server-side; no `VITE_` exposure.

## Build order

1. Cloud + auth + schema/RLS/grants + seed provider rows and default topic pool.
2. Design system, RTL shell, login, dashboard skeleton.
3. Provider abstraction + mock implementations.
4. Job model, lease/pause/retry worker loop, cron tick.
5. Pipeline steps 1–6 writing real rows and files.
6. Quality check + render stub + dashboard progress timeline.
7. Character library, videos browser, settings.
8. YouTube OAuth + upload + weekly scheduler.
