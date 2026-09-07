# Kids Shorts AI — External FFmpeg Renderer API Contract

Kids Shorts AI produces images, Arabic narration, subtitles and (optionally) music,
then hands a **timeline** to an external renderer service that you host yourself.
This document is the exact contract that service must implement.

Base URL example: `https://render.example.com`
Configured in the app under **الإعدادات → مُركِّب الفيديو → عنوان مُركِّب FFmpeg**.

## Authentication

Every request from Kids Shorts AI carries:

```
Authorization: Bearer <FFMPEG_WORKER_TOKEN>
Content-Type: application/json
```

The token is stored as a secret in Kids Shorts AI. Your service must reject any
request without a matching token with `401 { "error": "unauthorized" }`.

When the renderer calls back into Kids Shorts AI it must send the **same** token
in the same header.

## Endpoints

### `GET /health`

```json
{ "status": "healthy", "ffmpeg": "6.1", "queue": 0, "version": "1.0.0" }
```

Return HTTP 200 only when FFmpeg is present and the worker can accept jobs.

### `POST /render`

Request body:

```json
{
  "jobId": "uuid-of-the-production",
  "callbackUrl": "https://<app>/api/public/render-callback",
  "callbackToken": "<same bearer token>",
  "output": {
    "format": "mp4",
    "codec": "h264",
    "audioCodec": "aac",
    "width": 1080,
    "height": 1920,
    "fps": 25,
    "crf": 21,
    "preset": "medium"
  },
  "subtitles": { "burnIn": true, "language": "ar", "direction": "rtl" },
  "kenBurns": { "enabled": true, "intensity": 0.12 },
  "timeline": {
    "jobId": "uuid-of-the-production",
    "width": 1080,
    "height": 1920,
    "fps": 25,
    "totalSeconds": 42.5,
    "scenes": [
      {
        "sceneNumber": 1,
        "start": 0,
        "length": 7.4,
        "imageUrl": "https://…signed-url…/scene-1.png",
        "audioUrl": "https://…signed-url…/scene-1.mp3",
        "caption": "نص المشهد بالعربية",
        "animation": "zoom-in"
      }
    ],
    "subtitlesVtt": "WEBVTT\n\n00:00:00.000 --> 00:00:07.400\nنص…",
    "musicUrl": null
  },
  "test": false
}
```

Notes:

- All media URLs are **temporary signed HTTPS URLs** (valid ~6 hours). Download them.
- `animation` is a hint: `zoom-in`, `zoom-out`, `pan-left`, `pan-right`. When absent,
  alternate gently between them. Keep motion subtle (≈ `intensity` of the frame).
- Scenes are sequential: scene `n` starts at `start` and lasts `length` seconds,
  which already matches the narration duration. Keep audio and image in sync.
- `subtitlesVtt` is WebVTT in Arabic; render right-to-left, centered, with a
  readable outline. If `burnIn` is false, mux as a soft subtitle track instead.
- `musicUrl`, when present, is background music: loop/trim to `totalSeconds`
  and mix at roughly −18 dB under the narration.
- `test: true` means a connection test — validate the payload, optionally render a
  one-second clip, and respond normally. Do not call back for test jobs.

Success response (HTTP 202):

```json
{ "renderId": "rnd_01H…", "status": "queued", "acceptedAt": "2026-09-07T21:00:00Z" }
```

Errors: `400 { "error": "…" }` invalid payload, `401` bad token,
`429 { "error": "queue full", "retryAfter": 120 }`, `500 { "error": "…" }`.

Rendering must be **asynchronous** — respond immediately, render in the background.

### `GET /render/{renderId}`

```json
{
  "renderId": "rnd_01H…",
  "jobId": "uuid-of-the-production",
  "status": "processing",
  "progress": 42,
  "stage": "encoding",
  "url": null,
  "error": null,
  "updatedAt": "2026-09-07T21:03:10Z"
}
```

`status` is one of `queued`, `processing`, `completed`, `failed`, `cancelled`.
`progress` is 0–100. When `completed`, `url` must be a directly downloadable
HTTPS MP4 URL, valid for at least 1 hour. When `failed`, `error` must be a clear
human-readable message. Unknown ids return `404`.

### `POST /render/{renderId}/cancel`

```json
{ "renderId": "rnd_01H…", "status": "cancelled" }
```

Stops the FFmpeg process and frees the job. Already finished jobs return `409`.

## Callback into Kids Shorts AI

As soon as a render finishes or fails, POST to `callbackUrl` with the bearer token:

```json
{ "jobId": "uuid-of-the-production", "renderId": "rnd_01H…", "status": "completed", "videoUrl": "https://…/final.mp4" }
```

or

```json
{ "jobId": "uuid-of-the-production", "renderId": "rnd_01H…", "status": "failed", "error": "ffmpeg exited with code 1: …" }
```

Optional progress pings are accepted and ignored safely:

```json
{ "jobId": "…", "status": "processing", "progress": 60 }
```

Kids Shorts AI downloads the MP4, stores it privately, then continues to the
quality check and the private YouTube upload. If the callback never arrives, the
app polls `GET /render/{renderId}` hourly, so a missed callback is not fatal.

## Rendering requirements

1. Download every image and audio file from the signed URLs.
2. Build a 1080×1920 (9:16) canvas at 25 fps; letterbox nothing — crop/scale to fill.
3. Apply gentle Ken Burns motion per scene (zoom in/out, pan left/right).
4. Concatenate scenes in `sceneNumber` order, each with its narration audio.
5. Burn in the Arabic subtitles (RTL shaping — use `libass` with a font that
   supports Arabic, e.g. Noto Naskh Arabic).
6. Mix optional background music under the narration.
7. Encode H.264 (`yuv420p`) + AAC 128 kbps, `+faststart`, suitable for YouTube Shorts.
8. Publish the file at a downloadable URL and call back.

Reference FFmpeg shape (per scene, then concat):

```
ffmpeg -loop 1 -t 7.4 -i scene-1.png -i scene-1.mp3 \
  -filter_complex "zoompan=z='min(zoom+0.0006,1.12)':d=185:s=1080x1920:fps=25,format=yuv420p" \
  -c:v libx264 -crf 21 -preset medium -c:a aac -b:a 128k -movflags +faststart scene-1.mp4
```
