import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export class CancelledError extends Error {
  constructor() {
    super("cancelled");
    this.name = "CancelledError";
  }
}

/** Runs ffmpeg/ffprobe and rejects with the tail of stderr on failure. */
export function run(bin, args, { onCancelCheck } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err = (err + d.toString()).slice(-4000)));

    const timer = onCancelCheck
      ? setInterval(async () => {
          if (await onCancelCheck()) {
            child.kill("SIGKILL");
          }
        }, 2000)
      : null;

    child.on("error", (e) => {
      if (timer) clearInterval(timer);
      reject(e);
    });
    child.on("close", (code, signal) => {
      if (timer) clearInterval(timer);
      if (signal === "SIGKILL") return reject(new CancelledError());
      if (code === 0) return resolve(out);
      reject(new Error(`${path.basename(bin)} exited with code ${code}: ${err.trim()}`));
    });
  });
}

export async function ffmpegVersion() {
  const out = await run("ffmpeg", ["-hide_banner", "-version"]);
  return /ffmpeg version (\S+)/.exec(out)?.[1] ?? "unknown";
}

/** Downloads a signed asset URL to disk with a couple of retries. */
export async function download(url, target) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok || !response.body) {
        throw new Error(`download failed (${response.status}) for ${short(url)}`);
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
      return target;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastError;
}

export async function durationOf(file) {
  const out = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    file,
  ]);
  const value = Number(out.trim());
  return Number.isFinite(value) ? value : 0;
}

const short = (url) => url.split("?")[0];
