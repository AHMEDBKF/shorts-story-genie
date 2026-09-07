import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";

/**
 * Crash-safe job persistence: one JSON file per render job, written
 * atomically (tmp file + rename). No database to run, survives restarts,
 * and a half-written file can never corrupt the queue.
 */

const file = (renderId) => path.join(config.jobsDir, `${renderId}.json`);

export async function initStore() {
  await Promise.all([
    fs.mkdir(config.jobsDir, { recursive: true }),
    fs.mkdir(config.workDir, { recursive: true }),
    fs.mkdir(config.outputDir, { recursive: true }),
  ]);
}

export function newRenderId() {
  return `rnd_${crypto.randomBytes(12).toString("hex")}`;
}

export async function createJob(payload) {
  const renderId = newRenderId();
  const job = {
    renderId,
    jobId: payload.jobId,
    status: "queued",
    progress: 0,
    stage: "queued",
    url: null,
    error: null,
    attempts: 0,
    cancelRequested: false,
    callbackUrl: payload.callbackUrl ?? null,
    callbackToken: payload.callbackToken ?? null,
    request: payload,
    acceptedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeJob(job);
  return job;
}

export async function writeJob(job) {
  job.updatedAt = new Date().toISOString();
  const target = file(job.renderId);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(job, null, 2));
  await fs.rename(tmp, target);
  return job;
}

export async function readJob(renderId) {
  if (!/^rnd_[a-f0-9]{24}$/.test(renderId)) return null;
  try {
    return JSON.parse(await fs.readFile(file(renderId), "utf8"));
  } catch {
    return null;
  }
}

export async function updateJob(renderId, patch) {
  const job = await readJob(renderId);
  if (!job) return null;
  return writeJob(Object.assign(job, patch));
}

export async function listJobs() {
  const names = await fs.readdir(config.jobsDir).catch(() => []);
  const jobs = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const job = await readJob(name.replace(/\.json$/, ""));
    if (job) jobs.push(job);
  }
  return jobs;
}

export async function deleteJob(renderId) {
  await fs.rm(file(renderId), { force: true });
}
