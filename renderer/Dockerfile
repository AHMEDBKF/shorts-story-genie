FROM node:20-bookworm-slim

# FFmpeg + Arabic-capable fonts (libass shapes RTL text with these).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
      ffmpeg \
      fonts-noto-core \
      fonts-noto-extra \
      ca-certificates \
      curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

ENV NODE_ENV=production \
    RENDERER_PORT=8080 \
    DATA_DIR=/data

RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${RENDERER_PORT}/health" || exit 1

CMD ["node", "src/server.js"]
