import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { CancelledError } from "./ffmpeg.js";
import { renderTimeline } from "./render.js";
import { publish } from "./storage.js";
import { deleteJob, listJobs, readJob, updateJob, writeJob } from "./store.js";

const MAX_ATTEMPTS = 3;
let running = 0;
let ticking = false;

/** Anything left "processing" after a restart goes back into the queue. */
export async function recoverAfterRestart() {
  for (const job of await listJobs()) {
    if (job.status === "processing") {
      job.status = "queued";
      job.stage = "requeued after restart";
      job.progress = 0;
      await writeJob(job);
    }
    await fs.rm(path.join(config.workDir, job.renderId), { recursive: true, force: true });
  }
}

export function kick() {
  if (ticking) return;
  ticking = true;
  setImmediate(async () => {
    ticking = false;
    await tick();
  });
}

async function tick() {
  if (running >= config.maxConcurrentRenders) return;
  const jobs = (await listJobs())
    .filter((job) => job.status === "queued" && !job.cancelRequested)
    .sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt));
  const next = jobs[0];
  if (!next) return;

  running += 1;
  process(next.renderId)
    .catch(() => {})
    .finally(() => {
      running -= 1;
      kick();
    });
  if (running < config.maxConcurrentRenders) kick();
}

async function process(renderId) {
  const job = await updateJob(renderId, {
    status: "processing",
    stage: "starting",
    progress: 1,
    error: null,
    attempts: ((await readJob(renderId))?.attempts ?? 0) + 1,
  });
  if (!job) return;

  const isCancelled = async () => Boolean((await readJob(renderId))?.cancelRequested);
  const onProgress = async (progress, stage) => {
    await updateJob(renderId, { progress, stage });
    await notify(job, { status: "processing", progress });
  };

  try {
    const { output, dir } = await renderTimeline(job, { onProgress, isCancelled });
    if (await isCancelled()) throw new CancelledError();

    const url = await publish(renderId, output);
    await fs.rm(dir, { recursive: true, force: true });

    const done = await updateJob(renderId, {
      status: "completed",
      progress: 100,
      stage: "completed",
      url,
      error: null,
    });
    await notify(done, { status: "completed", videoUrl: url });
  } catch (error) {
    await fs.rm(path.join(config.workDir, renderId), { recursive: true, force: true });
    const current = await readJob(renderId);
    if (!current) return;

    if (error instanceof CancelledError || current.cancelRequested) {
      const cancelled = await updateJob(renderId, {
        status: "cancelled",
        stage: "cancelled",
        error: null,
      });
      await notify(cancelled, { status: "cancelled" });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    if (current.attempts < MAX_ATTEMPTS) {
      // Retry-safe: the job goes back to the queue with its payload intact.
      await updateJob(renderId, {
        status: "queued",
        stage: `retrying after error (${current.attempts}/${MAX_ATTEMPTS})`,
        progress: 0,
        error: message,
      });
      return;
    }

    const failed = await updateJob(renderId, {
      status: "failed",
      stage: "failed",
      error: message,
    });
    await notify(failed, { status: "failed", error: message });
  }
}

/** Reports back to Kids Shorts AI. Never throws — polling is the safety net. */
async function notify(job, payload) {
  if (!job?.callbackUrl || job.request?.test) return;
  try {
    await fetch(job.callbackUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${job.callbackToken ?? config.apiKey}`,
      },
      body: JSON.stringify({ jobId: job.jobId, renderId: job.renderId, ...payload }),
    });
  } catch {
    /* ignored on purpose */
  }
}

/** Deletes stale jobs, orphan working folders and expired output files. */
export async function cleanup() {
  const now = Date.now();
  for (const job of await listJobs()) {
    const age = now - Date.parse(job.updatedAt || job.acceptedAt);
    const finished = ["completed", "failed", "cancelled"].includes(job.status);
    if (finished && age > config.jobRetentionHours * 3600_000) {
      await deleteJob(job.renderId);
    }
  }

  for (const entry of await fs.readdir(config.outputDir).catch(() => [])) {
    const file = path.join(config.outputDir, entry);
    const stat = await fs.stat(file).catch(() => null);
    if (stat && now - stat.mtimeMs > config.fileRetentionHours * 3600_000) {
      await fs.rm(file, { force: true });
    }
  }

  for (const entry of await fs.readdir(config.workDir).catch(() => [])) {
    const job = await readJob(entry);
    if (!job || ["completed", "failed", "cancelled"].includes(job.status)) {
      await fs.rm(path.join(config.workDir, entry), { recursive: true, force: true });
    }
  }
}

export async function queueDepth() {
  const jobs = await listJobs();
  return jobs.filter((job) => job.status === "queued" || job.status === "processing").length;
}
