import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { CancelledError, download, durationOf, run } from "./ffmpeg.js";

const W = 1080;
const H = 1920;

/**
 * Renders one production timeline into a YouTube-Shorts-ready MP4.
 * Every step is written into a per-job working directory that is deleted
 * once the file has been published.
 */
export async function renderTimeline(job, { onProgress, isCancelled }) {
  const request = job.request ?? {};
  const timeline = request.timeline ?? {};
  const scenes = [...(timeline.scenes ?? [])].sort(
    (a, b) => (a.sceneNumber ?? 0) - (b.sceneNumber ?? 0),
  );
  if (scenes.length === 0) throw new Error("timeline.scenes is empty");

  const fps = clamp(timeline.fps ?? request.output?.fps ?? 25, 12, 60);
  const crf = clamp(request.output?.crf ?? 21, 14, 32);
  const preset = request.output?.preset ?? "medium";
  const intensity = clamp(request.kenBurns?.intensity ?? 0.12, 0.02, 0.4);
  const kenBurns = request.kenBurns?.enabled !== false;
  const burnIn = request.subtitles?.burnIn !== false;

  const dir = path.join(config.workDir, job.renderId);
  await fs.mkdir(dir, { recursive: true });

  const guard = async () => {
    if (await isCancelled()) throw new CancelledError();
  };

  try {
    // 1) Assets ------------------------------------------------------------
    await onProgress(5, "downloading");
    const parts = [];
    for (const [index, scene] of scenes.entries()) {
      await guard();
      const image = path.join(dir, `scene-${index}.img`);
      await download(scene.imageUrl, image);

      let audio = null;
      let length = Number(scene.length) || 6;
      if (scene.audioUrl) {
        audio = path.join(dir, `scene-${index}.audio`);
        await download(scene.audioUrl, audio);
        const measured = await durationOf(audio);
        if (measured > 0.5) length = measured;
      }
      parts.push({ index, image, audio, length: Math.max(1, length), scene });
      await onProgress(5 + Math.round((index + 1) / scenes.length * 20), "downloading");
    }

    let music = null;
    if (timeline.musicUrl) {
      music = path.join(dir, "music.audio");
      await download(timeline.musicUrl, music).catch(() => (music = null));
    }

    // 2) One clip per scene, with Ken Burns motion -------------------------
    const clips = [];
    for (const part of parts) {
      await guard();
      const clip = path.join(dir, `clip-${part.index}.mp4`);
      const frames = Math.max(1, Math.round(part.length * fps));
      const motion = kenBurns
        ? kenBurnsFilter(part.scene.animation, part.index, frames, fps, intensity)
        : `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;

      const args = ["-y", "-hide_banner", "-loglevel", "error", "-loop", "1", "-t", String(part.length), "-i", part.image];
      if (part.audio) args.push("-i", part.audio);
      else args.push("-f", "lavfi", "-t", String(part.length), "-i", "anullsrc=r=48000:cl=stereo");

      args.push(
        "-filter_complex",
        `[0:v]${motion},format=yuv420p[v]`,
        "-map", "[v]",
        "-map", "1:a",
        "-c:v", "libx264",
        "-crf", String(crf),
        "-preset", preset,
        "-r", String(fps),
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ar", "48000",
        "-ac", "2",
        "-shortest",
        "-t", String(part.length),
        clip,
      );
      await run("ffmpeg", args, { onCancelCheck: isCancelled });
      clips.push(clip);
      await onProgress(
        25 + Math.round(((part.index + 1) / parts.length) * 45),
        "rendering scenes",
      );
    }

    // 3) Concatenate -------------------------------------------------------
    await guard();
    await onProgress(72, "joining");
    const listFile = path.join(dir, "clips.txt");
    await fs.writeFile(listFile, clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join("\n"));
    const joined = path.join(dir, "joined.mp4");
    await run("ffmpeg", [
      "-y", "-hide_banner", "-loglevel", "error",
      "-f", "concat", "-safe", "0", "-i", listFile,
      "-c", "copy", joined,
    ], { onCancelCheck: isCancelled });

    const total = parts.reduce((sum, part) => sum + part.length, 0);

    // 4) Subtitles + music -------------------------------------------------
    await guard();
    await onProgress(80, "subtitles");
    const output = path.join(dir, "final.mp4");
    const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", joined];

    let subtitlePath = null;
    if (timeline.subtitlesVtt) {
      subtitlePath = path.join(dir, "subs.ass");
      await buildAss(timeline.subtitlesVtt, subtitlePath, isCancelled, dir);
    }
    if (music) args.push("-stream_loop", "-1", "-i", music);

    const filters = [];
    if (subtitlePath && burnIn) {
      filters.push(`[0:v]subtitles=${escapeForFilter(subtitlePath)}[v]`);
    } else {
      filters.push("[0:v]null[v]");
    }
    if (music) {
      filters.push(
        `[1:a]volume=0.13,atrim=0:${total.toFixed(3)},asetpts=N/SR/TB[bg]`,
        "[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]",
      );
    } else {
      filters.push("[0:a]anull[a]");
    }

    args.push(
      "-filter_complex", filters.join(";"),
      "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-crf", String(crf), "-preset", preset,
      "-pix_fmt", "yuv420p", "-r", String(fps),
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      "-t", total.toFixed(3),
    );

    if (subtitlePath && !burnIn) {
      args.push("-i", subtitlePath, "-map", "2:s", "-c:s", "mov_text", "-metadata:s:s:0", "language=ara");
    }
    args.push(output);

    await run("ffmpeg", args, { onCancelCheck: isCancelled });
    await onProgress(95, "encoding");
    return { output, dir, seconds: total };
  } catch (error) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

/** Gentle zoom/pan hint per scene; alternates when the hint is missing. */
function kenBurnsFilter(animation, index, frames, fps, intensity) {
  const kinds = ["zoom-in", "zoom-out", "pan-left", "pan-right"];
  const kind = kinds.includes(animation) ? animation : kinds[index % kinds.length];
  const zoomMax = (1 + intensity).toFixed(4);
  const step = (intensity / frames).toFixed(6);
  const pre = `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2}`;
  const base = `zoompan=d=${frames}:s=${W}x${H}:fps=${fps}`;

  switch (kind) {
    case "zoom-out":
      return `${pre},${base}:z='max(${zoomMax}-on*${step},1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
    case "pan-left":
      return `${pre},${base}:z='${(1 + intensity / 2).toFixed(4)}':x='(iw-iw/zoom)*(1-on/${frames})':y='ih/2-(ih/zoom/2)'`;
    case "pan-right":
      return `${pre},${base}:z='${(1 + intensity / 2).toFixed(4)}':x='(iw-iw/zoom)*(on/${frames})':y='ih/2-(ih/zoom/2)'`;
    default:
      return `${pre},${base}:z='min(1.0+on*${step},${zoomMax})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
  }
}

/**
 * Converts the Arabic WebVTT into ASS so libass shapes the script correctly
 * (RTL, centered, readable outline, Noto Naskh Arabic).
 */
async function buildAss(vtt, target, isCancelled, dir) {
  const source = path.join(dir, "subs.vtt");
  await fs.writeFile(source, vtt, "utf8");
  await run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", source, target], {
    onCancelCheck: isCancelled,
  });
  const ass = await fs.readFile(target, "utf8");
  const styled = ass.replace(
    /^Style: Default,.*$/m,
    "Style: Default,Noto Naskh Arabic,58,&H00FFFFFF,&H000000FF,&H00101010,&H90000000,-1,0,0,0,100,100,0,0,1,4,1,2,60,60,150,1",
  );
  await fs.writeFile(target, styled, "utf8");
  return target;
}

const escapeForFilter = (file) => `'${file.replace(/'/g, "\\'").replace(/:/g, "\\:")}'`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
