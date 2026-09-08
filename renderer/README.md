# Kids Shorts AI — self-hosted FFmpeg renderer

A standalone Docker service that turns a Kids Shorts AI timeline into a
1080×1920 H.264 MP4 ready for YouTube Shorts. It implements the contract in
[`../docs/FFMPEG_RENDERER_API.md`](../docs/FFMPEG_RENDERER_API.md) exactly.

It is independent of the app: deploy it to any VPS or Docker host, point Kids
Shorts AI at its URL, and share one secret key between the two.

Full server guide: [`DEPLOYMENT.md`](./DEPLOYMENT.md).
End-to-end test checklist: [`../docs/END_TO_END_TEST.md`](../docs/END_TO_END_TEST.md).

## Deploy in three commands

```bash
cp .env.example .env
# set RENDERER_API_KEY (openssl rand -hex 32), RENDERER_PORT, PUBLIC_BASE_URL
docker compose up -d --build
```

Verify:

```bash
curl -H "Authorization: Bearer $RENDERER_API_KEY" http://localhost:8080/health
# {"status":"healthy","ffmpeg":"6.1.1","queue":0,"version":"1.0.0"}
```

Put it behind Caddy/nginx with TLS so the URL is HTTPS, then in Kids Shorts AI
open الإعدادات → مُركِّب الفيديو, enter the renderer URL, save the shared key,
and press «اختبار الاتصال بمُركِّب FFmpeg».

## What you configure

| Variable | Meaning |
| --- | --- |
| `RENDERER_API_KEY` | Shared secret; must equal `FFMPEG_WORKER_TOKEN` in the app. |
| `RENDERER_PORT` | Listening port (published by compose). |
| `STORAGE_DRIVER` | `local` (serve from this box) or `s3` (R2/S3/Spaces). |
| `PUBLIC_BASE_URL` | Public HTTPS URL of this service — used to build MP4 links. |
| `S3_*` | Only when `STORAGE_DRIVER=s3`. |
| `DATA_DIR` | Volume root for jobs, work files and outputs. Default `/data`. |

Everything else has production-safe defaults
(`MAX_CONCURRENT_RENDERS=1`, `JOB_RETENTION_HOURS=48`, `FILE_RETENTION_HOURS=24`).

## Endpoints

All require `Authorization: Bearer <RENDERER_API_KEY>`.

- `GET /health` — API uptime, FFmpeg version, queue depth and storage writability
  (`503 degraded` when FFmpeg or storage is unavailable).
- `POST /render` — accepts a timeline, returns `202 { renderId, status: "queued" }`.
- `GET /render/{renderId}` — status, progress 0–100, stage, url, error.
- `POST /render/{renderId}/cancel` — kills the FFmpeg process, `409` when finished.
- `GET /files/{name}` — the finished MP4 (unguessable name, local storage only).

`{"test": true}` payloads are validated and accepted without rendering and
without a callback, which is what the Settings test button uses.

## How rendering works

1. Downloads every signed image/narration URL (3 attempts each) into
   `DATA_DIR/work/<renderId>/`.
2. Measures each narration with `ffprobe` so scene length always matches audio.
3. Renders one clip per scene with gentle Ken Burns motion — `zoom-in`,
   `zoom-out`, `pan-left`, `pan-right`, honouring the `animation` hint.
4. Concatenates the clips, burns the Arabic subtitles with libass and Noto
   Naskh Arabic (RTL, centered, outlined), mixes optional music at ≈ −18 dB.
5. Encodes H.264 `yuv420p` + AAC 128 kbps with `+faststart`.
6. Publishes the file and POSTs the callback to Kids Shorts AI.

## Reliability

- **Persistent jobs** — one atomically written JSON file per job under
  `DATA_DIR/jobs/`. No database, survives container restarts.
- **Restart recovery** — jobs that were mid-render are re-queued at boot and
  their working folders are cleared.
- **Retry-safe** — a failed render is retried up to 3 times before the failure
  is reported; the original payload is never mutated.
- **Cancellation** — a cancel flag is polled every 2 s and kills FFmpeg.
- **Cleanup** — working folders are removed after each job; outputs expire
  after `FILE_RETENTION_HOURS`, job records after `JOB_RETENTION_HOURS`.
- **Callbacks are best-effort** — if one is lost, the app's hourly poll of
  `GET /render/{renderId}` still finishes the production.

## Sizing

A 2 vCPU / 2 GB VPS renders a 45-second Short in roughly one to two minutes at
`preset=medium`. Raise `MAX_CONCURRENT_RENDERS` only with more cores.
