# Deploying the Kids Shorts AI FFmpeg Renderer

A complete, copy-paste guide for putting the renderer on your own server.

## 1. VPS specifications

| | Minimum | Recommended |
| --- | --- | --- |
| vCPU | 2 | 4 (rendering is CPU-bound) |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB SSD | 40 GB SSD |
| Network | 1 TB/month | 2 TB/month |

One 45-second Short takes roughly 1–3 minutes on 2 vCPU with `MAX_CONCURRENT_RENDERS=1`.
Raise concurrency only with 4+ vCPU.

## 2. Operating system

Ubuntu 22.04 LTS or 24.04 LTS (x86_64). Debian 12 works identically.
Everything runs inside Docker, so no FFmpeg or Node install is needed on the host.

## 3. Install Docker and Docker Compose

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker --version
docker compose version     # Compose v2 ships with Docker Engine
```

## 4. Get the renderer onto the server

Copy this `renderer/` folder to the VPS (git clone, `scp -r renderer user@host:~/renderer`, or rsync).

```bash
cd ~/renderer
cp .env.example .env
```

## 5. Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `RENDERER_API_KEY` | yes | Shared secret; must equal `FFMPEG_WORKER_TOKEN` saved in Kids Shorts AI. |
| `RENDERER_PORT` | yes | Listening port, default `8080`. |
| `PUBLIC_BASE_URL` | yes (local storage) | Public HTTPS URL of this service, used to build MP4 links. |
| `STORAGE_DRIVER` | yes | `local` or `s3`. |
| `DATA_DIR` | no | Volume root, default `/data`. |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_PUBLIC_BASE_URL` | only with `STORAGE_DRIVER=s3` | S3/R2/Spaces target. |
| `MAX_CONCURRENT_RENDERS` | no | Default `1`. |
| `JOB_RETENTION_HOURS` / `FILE_RETENTION_HOURS` | no | Default `48` / `24`. |

## 6. Generate a strong RENDERER_API_KEY

```bash
openssl rand -hex 32
```

Paste the value into `.env` as `RENDERER_API_KEY`. Keep the same value at hand — you will
save it once inside Kids Shorts AI (server-side only; it never appears in the browser).
Never commit `.env` and never place the key in any frontend file.

## 7. Start the renderer

```bash
docker compose up -d --build
docker compose ps
```

## 8. Check the health endpoint

```bash
curl -H "Authorization: Bearer $RENDERER_API_KEY" http://localhost:8080/health
```

Healthy response:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "api": { "ok": true, "uptimeSeconds": 42 },
  "ffmpeg": "6.1.1",
  "ffmpegHealth": { "ok": true, "version": "6.1.1" },
  "queue": 0,
  "queueHealth": { "ok": true, "depth": 0, "maxConcurrent": 1 },
  "storage": { "driver": "local", "writable": true, "detail": "writable" }
}
```

`503 degraded` means FFmpeg or storage is unavailable — read the `storage.detail` field.

## 9. Put it behind HTTPS

Kids Shorts AI must call an HTTPS URL. Simplest option, Caddy:

```bash
sudo apt install -y caddy
echo 'render.example.com {
  reverse_proxy 127.0.0.1:8080
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

Then set `PUBLIC_BASE_URL=https://render.example.com` in `.env` and restart.

## 10. Restart

```bash
docker compose restart          # keeps data
docker compose down && docker compose up -d   # full recreate
```

Queued jobs survive restarts: anything left mid-render is re-queued automatically.

## 11. Update

```bash
cd ~/renderer
git pull            # or re-copy the folder
docker compose up -d --build
docker image prune -f
```

## 12. Read logs

```bash
docker compose logs -f --tail=200 renderer
docker compose logs --since=1h renderer | grep -i error
```

## 13. Connect it to Kids Shorts AI

1. In the app: الإعدادات → مُركِّب الفيديو → paste the renderer URL (`https://render.example.com`).
2. Ask the assistant to open the secure box for `FFMPEG_WORKER_TOKEN` and paste the same key.
3. Press «اختبار الاتصال بمُركِّب FFmpeg» — all four checks must pass.
4. Set المُركِّب المفضّل to «مُركِّب FFmpeg الخاص بك».
