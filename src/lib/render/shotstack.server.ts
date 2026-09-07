import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "media";
const SIGNED_URL_SECONDS = 60 * 60 * 6;

export const APP_BASE_URL =
  process.env["APP_BASE_URL"] ??
  "https://project--3b512f28-6bb3-4025-85c6-6be4d16bd44f.lovable.app";

function apiBase() {
  const env = process.env["SHOTSTACK_ENV"] === "stage" ? "stage" : "v1";
  return `https://api.shotstack.io/edit/${env}`;
}

export function shotstackKey(): string | null {
  return process.env["SHOTSTACK_API_KEY"] ?? null;
}

async function signed(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

const EFFECTS = ["zoomIn", "slideLeft", "zoomOut", "slideRight", "slideUp"] as const;

/**
 * Builds a 1080x1920 timeline from the scene images, Arabic narration and
 * subtitles, and submits it to the external assembly service.
 * Returns the service's render id.
 */
export async function submitShotstackRender(jobId: string): Promise<string> {
  const key = shotstackKey();
  if (!key) throw new Error("لم يتم ضبط مفتاح خدمة التركيب.");

  const [{ data: scenes }, { data: images }, { data: audio }] = await Promise.all([
    supabaseAdmin
      .from("scenes")
      .select("id, scene_number, duration_seconds, narration, dialogue")
      .eq("job_id", jobId)
      .order("scene_number"),
    supabaseAdmin.from("generated_images").select("scene_id, storage_path").eq("job_id", jobId),
    supabaseAdmin
      .from("audio_files")
      .select("scene_id, storage_path, duration_seconds")
      .eq("job_id", jobId),
  ]);

  if (!scenes || scenes.length === 0) throw new Error("لا توجد مشاهد للتركيب.");

  const imageByScene = new Map((images ?? []).map((row) => [row.scene_id, row]));
  const audioByScene = new Map((audio ?? []).map((row) => [row.scene_id, row]));

  const imageClips: unknown[] = [];
  const audioClips: unknown[] = [];
  const titleClips: unknown[] = [];
  let start = 0;

  for (const [index, scene] of scenes.entries()) {
    const voice = audioByScene.get(scene.id);
    const image = imageByScene.get(scene.id);
    const length = Math.max(
      2,
      Number(voice?.duration_seconds ?? scene.duration_seconds ?? 6),
    );

    const imageUrl = await signed(image?.storage_path ?? null);
    if (!imageUrl) throw new Error(`الصورة غير جاهزة للمشهد ${scene.scene_number}`);

    imageClips.push({
      asset: { type: "image", src: imageUrl },
      start,
      length,
      fit: "cover",
      effect: EFFECTS[index % EFFECTS.length],
      transition: index === 0 ? undefined : { in: "fade" },
    });

    const voiceUrl = await signed(voice?.storage_path ?? null);
    if (voiceUrl) {
      audioClips.push({ asset: { type: "audio", src: voiceUrl }, start, length });
    }

    const caption = [scene.narration, scene.dialogue].filter(Boolean).join(" — ");
    if (caption) {
      titleClips.push({
        asset: {
          type: "title",
          text: caption.slice(0, 180),
          style: "subtitle",
          size: "small",
          position: "bottom",
          offset: { y: 0.08 },
        },
        start,
        length,
      });
    }

    start += length;
  }

  const body = {
    timeline: {
      background: "#000000",
      tracks: [{ clips: titleClips }, { clips: imageClips }, { clips: audioClips }],
    },
    output: {
      format: "mp4",
      size: { width: 1080, height: 1920 },
      fps: 25,
    },
    callback: `${APP_BASE_URL}/api/public/shotstack-callback`,
  };

  const response = await fetch(`${apiBase()}/render`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; response?: { id?: string }; message?: string }
    | null;

  if (!response.ok || !payload?.response?.id) {
    throw new Error(
      `تعذّر إرسال الفيديو لخدمة التركيب (${response.status}): ${payload?.message ?? ""}`.trim(),
    );
  }
  return payload.response.id;
}

export type RenderStatus =
  | { status: "pending" }
  | { status: "done"; url: string }
  | { status: "failed"; error: string };

/** Asks the assembly service how a submitted render is doing. */
export async function pollShotstackRender(renderId: string): Promise<RenderStatus> {
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
}
