import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Timeline, TimelineScene } from "./types";

const BUCKET = "media";
const SIGNED_URL_SECONDS = 60 * 60 * 6;

export const APP_BASE_URL =
  process.env["APP_BASE_URL"] ??
  "https://project--3b512f28-6bb3-4025-85c6-6be4d16bd44f.lovable.app";

export async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}

/**
 * Collects images, Arabic narration, subtitles and music of one production
 * into a single renderer-neutral timeline. Every renderer consumes this.
 */
export async function buildTimeline(jobId: string): Promise<Timeline> {
  const [{ data: scenes }, { data: images }, { data: audio }, { data: video }] =
    await Promise.all([
      supabaseAdmin
        .from("scenes")
        .select("id, scene_number, duration_seconds, narration, dialogue, animation")
        .eq("job_id", jobId)
        .order("scene_number"),
      supabaseAdmin.from("generated_images").select("scene_id, storage_path").eq("job_id", jobId),
      supabaseAdmin
        .from("audio_files")
        .select("scene_id, storage_path, duration_seconds, kind")
        .eq("job_id", jobId),
      supabaseAdmin
        .from("videos")
        .select("subtitles_vtt")
        .eq("job_id", jobId)
        .maybeSingle(),
    ]);

  if (!scenes || scenes.length === 0) throw new Error("لا توجد مشاهد للتركيب.");

  const imageByScene = new Map((images ?? []).map((row) => [row.scene_id, row]));
  const narrationByScene = new Map(
    (audio ?? []).filter((row) => row.kind === "narration").map((row) => [row.scene_id, row]),
  );
  const music = (audio ?? []).find((row) => row.kind === "music") ?? null;

  const timelineScenes: TimelineScene[] = [];
  let start = 0;

  for (const scene of scenes) {
    const voice = narrationByScene.get(scene.id);
    const length = Math.max(
      2,
      Number(voice?.duration_seconds ?? scene.duration_seconds ?? 6),
    );
    const imageUrl = await signedUrl(imageByScene.get(scene.id)?.storage_path ?? null);
    if (!imageUrl) throw new Error(`الصورة غير جاهزة للمشهد ${scene.scene_number}`);

    timelineScenes.push({
      sceneNumber: scene.scene_number,
      start,
      length,
      imageUrl,
      audioUrl: await signedUrl(voice?.storage_path ?? null),
      caption: [scene.narration, scene.dialogue].filter(Boolean).join(" — ").slice(0, 180),
      animation: scene.animation ?? null,
    });
    start += length;
  }

  return {
    jobId,
    width: 1080,
    height: 1920,
    fps: 25,
    totalSeconds: start,
    scenes: timelineScenes,
    subtitlesVtt: video?.subtitles_vtt ?? null,
    musicUrl: await signedUrl(music?.storage_path ?? null),
  };
}
