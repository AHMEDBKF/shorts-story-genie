import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { config } from "./config.js";
import { ffmpegVersion } from "./ffmpeg.js";
import { cleanup, kick, queueDepth, recoverAfterRestart } from "./queue.js";
import { createJob, initStore, readJob, updateJob } from "./store.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "8mb" }));

/** Shared-secret auth on every API endpoint, compared in constant time. */
function authorize(req, res, next) {
  const token = /^Bearer\s+([^\s,]+)$/i.exec(req.get("authorization") ?? "")?.[1] ?? "";
  const expected = config.apiKey;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

app.get("/health", authorize, async (_req, res) => {
  try {
    res.json({
      status: "healthy",
      ffmpeg: await ffmpegVersion(),
      queue: await queueDepth(),
      version: config.version,
    });
  } catch (error) {
    res.status(500).json({ status: "unhealthy", error: String(error?.message ?? error) });
  }
});

app.post("/render", authorize, async (req, res) => {
  const body = req.body ?? {};
  if (!body.jobId || typeof body.jobId !== "string") {
    return res.status(400).json({ error: "jobId is required" });
  }
  const scenes = body.timeline?.scenes;
  if (!Array.isArray(scenes)) {
    return res.status(400).json({ error: "timeline.scenes must be an array" });
  }
  if (!body.test && scenes.length === 0) {
    return res.status(400).json({ error: "timeline.scenes is empty" });
  }
  if ((await queueDepth()) >= config.maxConcurrentRenders * 20) {
    return res.status(429).json({ error: "queue full", retryAfter: 120 });
  }

  const job = await createJob(body);
  if (body.test) {
    // Connection test: payload accepted and validated, nothing is rendered.
    await updateJob(job.renderId, { status: "cancelled", stage: "test", progress: 0 });
  } else {
    kick();
  }
  return res
    .status(202)
    .json({ renderId: job.renderId, status: "queued", acceptedAt: job.acceptedAt });
});

app.get("/render/:renderId", authorize, async (req, res) => {
  const job = await readJob(req.params.renderId);
  if (!job) return res.status(404).json({ error: "unknown renderId" });
  res.json({
    renderId: job.renderId,
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    url: job.url,
    error: job.error,
    updatedAt: job.updatedAt,
  });
});

app.post("/render/:renderId/cancel", authorize, async (req, res) => {
  const job = await readJob(req.params.renderId);
  if (!job) return res.status(404).json({ error: "unknown renderId" });
  if (["completed", "failed", "cancelled"].includes(job.status)) {
    return res.status(409).json({ renderId: job.renderId, status: job.status });
  }
  const updated = await updateJob(job.renderId, {
    cancelRequested: true,
    status: job.status === "queued" ? "cancelled" : job.status,
    stage: "cancelling",
  });
  res.json({ renderId: updated.renderId, status: "cancelled" });
});

// Finished videos, served behind an unguessable filename (local storage only).
app.get("/files/:name", (req, res) => {
  if (!/^rnd_[a-f0-9]{24}\.[a-f0-9]{32}\.mp4$/.test(req.params.name)) {
    return res.status(404).end();
  }
  res.sendFile(path.join(config.outputDir, req.params.name), {
    headers: { "content-type": "video/mp4", "cache-control": "private, max-age=3600" },
  });
});

app.use((_req, res) => res.status(404).json({ error: "not found" }));

async function main() {
  if (!config.apiKey) {
    console.error("RENDERER_API_KEY is not set — refusing to start.");
    process.exit(1);
  }
  await initStore();
  await recoverAfterRestart();
  await cleanup();
  setInterval(() => cleanup().catch(() => {}), 30 * 60 * 1000).unref();
  setInterval(() => kick(), 15 * 1000).unref();
  kick();

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`FFmpeg renderer listening on :${config.port} (storage: ${config.storageDriver})`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
