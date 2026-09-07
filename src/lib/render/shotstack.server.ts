import { APP_BASE_URL, buildTimeline } from "./timeline.server";
import type { RenderStatus, VideoRenderer } from "./types";

function apiBase() {
  const env = process.env["SHOTSTACK_ENV"] === "stage" ? "stage" : "v1";
  return `https://api.shotstack.io/edit/${env}`;
}

export function shotstackKey(): string | null {
  return process.env["SHOTSTACK_API_KEY"] ?? null;
}

const EFFECTS = ["zoomIn", "slideLeft", "zoomOut", "slideRight", "slideUp"] as const;

/**
 * Optional paid renderer. Only used when a key is configured AND the user
 * explicitly allowed paid renderers.
 */
export const shotstackRenderer: VideoRenderer = {
  key: "shotstack",
  label: "Shotstack (خدمة تركيب مدفوعة)",
  costTier: "paid",

  async isConfigured() {
    return Boolean(shotstackKey());
  },

  async submit(jobId) {
    const key = shotstackKey();
    if (!key) throw new Error("لم يتم ضبط مفتاح خدمة التركيب.");

    const timeline = await buildTimeline(jobId);
    const imageClips: unknown[] = [];
    const audioClips: unknown[] = [];
    const titleClips: unknown[] = [];

    timeline.scenes.forEach((scene, index) => {
      imageClips.push({
        asset: { type: "image", src: scene.imageUrl },
        start: scene.start,
        length: scene.length,
        fit: "cover",
        effect: EFFECTS[index % EFFECTS.length],
        transition: index === 0 ? undefined : { in: "fade" },
      });
      if (scene.audioUrl) {
        audioClips.push({
          asset: { type: "audio", src: scene.audioUrl },
          start: scene.start,
          length: scene.length,
        });
      }
      if (scene.caption) {
        titleClips.push({
          asset: {
            type: "title",
            text: scene.caption,
            style: "subtitle",
            size: "small",
            position: "bottom",
            offset: { y: 0.08 },
          },
          start: scene.start,
          length: scene.length,
        });
      }
    });

    if (timeline.musicUrl) {
      audioClips.push({
        asset: { type: "audio", src: timeline.musicUrl, volume: 0.15 },
        start: 0,
        length: timeline.totalSeconds,
      });
    }

    const body = {
      timeline: {
        background: "#000000",
        tracks: [{ clips: titleClips }, { clips: imageClips }, { clips: audioClips }],
      },
      output: { format: "mp4", size: { width: 1080, height: 1920 }, fps: 25 },
      callback: `${APP_BASE_URL}/api/public/shotstack-callback`,
    };

    const response = await fetch(`${apiBase()}/render`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as
      | { response?: { id?: string }; message?: string }
      | null;

    if (!response.ok || !payload?.response?.id) {
      throw new Error(
        `تعذّر إرسال الفيديو لخدمة التركيب (${response.status}): ${payload?.message ?? ""}`.trim(),
      );
    }
    return payload.response.id;
  },

  async poll(renderId): Promise<RenderStatus> {
    const key = shotstackKey();
    if (!key) return { status: "failed", error: "لم يتم ضبط مفتاح خدمة التركيب." };

    const response = await fetch(`${apiBase()}/render/${renderId}`, {
      headers: { "x-api-key": key },
    });
    const payload = (await response.json().catch(() => null)) as
      | { response?: { status?: string; url?: string; error?: string } }
      | null;

    const status = payload?.response?.status;
    if (status === "done" && payload?.response?.url) {
      return { status: "done", url: payload.response.url };
    }
    if (status === "failed") {
      return { status: "failed", error: payload?.response?.error ?? "فشل التركيب النهائي." };
    }
    return { status: "pending" };
  },
};

export { APP_BASE_URL };
export type { RenderStatus };
