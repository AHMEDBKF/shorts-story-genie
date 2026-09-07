import { APP_BASE_URL, buildTimeline } from "./timeline.server";
import type { RenderStatus, RendererContext, VideoRenderer } from "./types";

/**
 * Free renderer: a small self-hosted FFmpeg worker. The app sends it the whole
 * timeline (images, Arabic narration, music, subtitles, timing) and the worker
 * posts the finished MP4 back to /api/public/render-callback.
 *
 * Expected worker contract:
 *   POST <workerUrl>  { jobId, callbackUrl, timeline }  -> { renderId }
 *   GET  <workerUrl>/<renderId>                         -> { status, url?, error? }
 */
export const ffmpegRenderer: VideoRenderer = {
  key: "ffmpeg",
  label: "مُركِّب FFmpeg الخاص بك",
  costTier: "free",

  async isConfigured(context) {
    return Boolean(context.ffmpegWorkerUrl);
  },

  async submit(jobId, context) {
    const base = requireWorker(context);
    const timeline = await buildTimeline(jobId);

    const response = await fetch(base, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        jobId,
        callbackUrl: `${APP_BASE_URL}/api/public/render-callback`,
        output: { format: "mp4", width: 1080, height: 1920, fps: 25 },
        timeline,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { renderId?: string; id?: string; error?: string }
      | null;
    const renderId = payload?.renderId ?? payload?.id;
    if (!response.ok || !renderId) {
      throw new Error(
        `تعذّر إرسال الفيديو للمُركِّب المحلي (${response.status}): ${payload?.error ?? ""}`.trim(),
      );
    }
    return renderId;
  },

  async poll(renderId, context): Promise<RenderStatus> {
    const base = requireWorker(context);
    const response = await fetch(`${base.replace(/\/$/, "")}/${renderId}`, {
      headers: headers(),
    });
    const payload = (await response.json().catch(() => null)) as
      | { status?: string; url?: string; error?: string }
      | null;

    if (payload?.status === "done" && payload.url) return { status: "done", url: payload.url };
    if (payload?.status === "failed") {
      return { status: "failed", error: payload.error ?? "فشل التركيب المحلي." };
    }
    return { status: "pending" };
  },
};

function requireWorker(context: RendererContext) {
  if (!context.ffmpegWorkerUrl) throw new Error("لم يتم ضبط عنوان المُركِّب المحلي.");
  return context.ffmpegWorkerUrl;
}

function headers(): Record<string, string> {
  const token = process.env["FFMPEG_WORKER_TOKEN"];
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}
