import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ffmpegRenderer } from "./ffmpeg.server";
import { shotstackRenderer } from "./shotstack.server";
import type { RendererContext, RendererKey, VideoRenderer } from "./types";

/** Every renderer the app knows about. Adding one means adding a line here. */
export const RENDERERS: Record<RendererKey, VideoRenderer> = {
  ffmpeg: ffmpegRenderer,
  shotstack: shotstackRenderer,
};

export function getRenderer(key: string | null | undefined): VideoRenderer | null {
  if (!key) return null;
  return RENDERERS[key as RendererKey] ?? null;
}

export interface RendererSettings {
  preference: "auto" | RendererKey;
  allowPaid: boolean;
  context: RendererContext;
}

export async function loadRendererSettings(userId: string): Promise<RendererSettings> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("render_provider, allow_paid_renderer, ffmpeg_worker_url")
    .eq("id", userId)
    .maybeSingle();

  const preference = (data?.render_provider ?? "auto") as RendererSettings["preference"];
  return {
    preference,
    allowPaid: data?.allow_paid_renderer ?? false,
    context: { userId, ffmpegWorkerUrl: data?.ffmpeg_worker_url ?? null },
  };
}

/**
 * Ordered list of renderers that may be used for this user: the preferred one
 * first, then the free ones as fallback. A paid renderer never appears unless
 * the user turned it on explicitly.
 */
export async function resolveRenderers(
  settings: RendererSettings,
): Promise<VideoRenderer[]> {
  const ordered: VideoRenderer[] = [];
  const preferred = settings.preference === "auto" ? null : RENDERERS[settings.preference];
  if (preferred) ordered.push(preferred);
  for (const renderer of [ffmpegRenderer, shotstackRenderer]) {
    if (!ordered.includes(renderer)) ordered.push(renderer);
  }

  const usable: VideoRenderer[] = [];
  for (const renderer of ordered) {
    if (renderer.costTier === "paid" && !settings.allowPaid) continue;
    if (!(await renderer.isConfigured(settings.context))) continue;
    usable.push(renderer);
  }
  return usable;
}
