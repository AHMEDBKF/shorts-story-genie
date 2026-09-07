import { APP_BASE_URL, buildTimeline } from "./timeline.server";
import type { RenderStatus, RendererContext, VideoRenderer } from "./types";

/**
 * Self-hosted FFmpeg renderer — the preferred free renderer.
 *
 * Contract implemented by the external service (see docs/FFMPEG_RENDERER_API.md):
 *   POST <base>/render                 -> { renderId, status }
 *   GET  <base>/render/{renderId}      -> { status, progress, url?, error? }
 *   POST <base>/render/{renderId}/cancel -> { status: "cancelled" }
 *   GET  <base>/health                 -> { status: "healthy", ffmpeg: "..." }
 * All requests carry `Authorization: Bearer <FFMPEG_WORKER_TOKEN>`.
 */
export const ffmpegRenderer: VideoRenderer = {
  key: "ffmpeg",
  label: "مُركِّب FFmpeg الخاص بك",
  costTier: "free",

  async isConfigured(context) {
    return Boolean(context.ffmpegWorkerUrl && process.env["FFMPEG_WORKER_TOKEN"]);
  },

  async submit(jobId, context) {
    const base = requireWorker(context);
    const timeline = await buildTimeline(jobId);

    const response = await fetch(`${base}/render`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(renderRequest(jobId, timeline)),
    });

    const payload = (await response.json().catch(() => null)) as
      | { renderId?: string; error?: string }
      | null;
    if (!response.ok || !payload?.renderId) {
      throw new Error(
        `تعذّر إرسال الفيديو إلى مُركِّب FFmpeg (${response.status}): ${payload?.error ?? ""}`.trim(),
      );
    }
    return payload.renderId;
  },

  async poll(renderId, context): Promise<RenderStatus> {
    const base = requireWorker(context);
    const response = await fetch(`${base}/render/${encodeURIComponent(renderId)}`, {
      headers: headers(),
    });
    const payload = (await response.json().catch(() => null)) as
      | { status?: string; url?: string; videoUrl?: string; error?: string }
      | null;

    if (response.status === 404) return { status: "failed", error: "لم يعد المُركِّب يعرف هذه المهمة." };
    if (!response.ok) return { status: "pending" };

    const url = payload?.url ?? payload?.videoUrl;
    if (payload?.status === "completed" && url) return { status: "done", url };
    if (payload?.status === "failed" || payload?.status === "cancelled") {
      return { status: "failed", error: payload.error ?? "فشل التركيب في مُركِّب FFmpeg." };
    }
    return { status: "pending" };
  },

  async cancel(renderId, context) {
    const base = requireWorker(context);
    await fetch(`${base}/render/${encodeURIComponent(renderId)}/cancel`, {
      method: "POST",
      headers: headers(),
    }).catch(() => null);
  },
};

/** The exact body the renderer receives on POST /render. */
export function renderRequest(jobId: string, timeline: unknown) {
  return {
    jobId,
    callbackUrl: `${APP_BASE_URL}/api/public/render-callback`,
    callbackToken: process.env["FFMPEG_WORKER_TOKEN"] ?? null,
    output: {
      format: "mp4",
      codec: "h264",
      audioCodec: "aac",
      width: 1080,
      height: 1920,
      fps: 25,
      crf: 21,
      preset: "medium",
    },
    subtitles: { burnIn: true, language: "ar", direction: "rtl" },
    kenBurns: { enabled: true, intensity: 0.12 },
    timeline,
  };
}

function requireWorker(context: RendererContext) {
  if (!context.ffmpegWorkerUrl) throw new Error("لم يتم ضبط عنوان مُركِّب FFmpeg.");
  return context.ffmpegWorkerUrl.replace(/\/+$/, "");
}

function headers(): Record<string, string> {
  const token = process.env["FFMPEG_WORKER_TOKEN"];
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}
