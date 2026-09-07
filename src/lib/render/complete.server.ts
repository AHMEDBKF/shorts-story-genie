import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Marks a production's assembly as failed and pauses it with a reason. */
export async function failRender(jobId: string, reason: string) {
  await supabaseAdmin.from("videos").update({ render_status: "failed" }).eq("job_id", jobId);
  await supabaseAdmin
    .from("production_jobs")
    .update({ status: "paused", paused_reason: reason, paused_at: new Date().toISOString() })
    .eq("id", jobId);
}

/**
 * Stores a finished MP4 and resumes the production so the quality check and
 * the YouTube upload run next.
 */
export async function completeRender(
  jobId: string,
  userId: string,
  videoUrl: string,
): Promise<{ ok: true; storagePath: string } | { ok: false; error: string; status: number }> {
  const source = await fetch(videoUrl);
  if (!source.ok) {
    return { ok: false, error: `could not fetch video (${source.status})`, status: 400 };
  }
  const bytes = new Uint8Array(await source.arrayBuffer());
  const path = `${userId}/${jobId}/final.mp4`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("media")
    .upload(path, bytes, { contentType: "video/mp4", upsert: true });
  if (uploadError) return { ok: false, error: uploadError.message, status: 500 };

  await supabaseAdmin
    .from("videos")
    .update({ storage_path: path, render_status: "rendered" })
    .eq("job_id", jobId);

  await supabaseAdmin
    .from("job_steps")
    .update({ status: "completed", detail: "تم استلام الفيديو النهائي." })
    .eq("job_id", jobId)
    .eq("step", "render_video");
  await supabaseAdmin
    .from("job_steps")
    .update({ status: "pending", detail: null, attempts: 0 })
    .eq("job_id", jobId)
    .in("step", ["quality_check", "upload_youtube"]);
  await supabaseAdmin
    .from("production_jobs")
    .update({
      status: "queued",
      paused_reason: null,
      paused_at: null,
      finished_at: null,
      next_run_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  return { ok: true, storagePath: path };
}

/** Backstop for missed callbacks: checks renders that are still in progress. */
export async function pollPendingRenders(): Promise<string[]> {
  const { getRenderer, loadRendererSettings } = await import("./registry.server");

  const { data: rows } = await supabaseAdmin
    .from("videos")
    .select("job_id, user_id, render_job_id, render_provider")
    .eq("render_status", "rendering")
    .limit(5);

  const log: string[] = [];
  for (const row of rows ?? []) {
    const renderer = getRenderer(row.render_provider);
    if (!renderer || !row.render_job_id) continue;
    const settings = await loadRendererSettings(row.user_id);
    try {
      const result = await renderer.poll(row.render_job_id, settings.context);
      if (result.status === "done") {
        const stored = await completeRender(row.job_id, row.user_id, result.url);
        log.push(`${row.job_id}: ${stored.ok ? "rendered" : stored.error}`);
      } else if (result.status === "failed") {
        await retryRender(row.job_id, result.error);
        log.push(`${row.job_id}: ${result.error}`);
      }
    } catch (error) {
      log.push(`${row.job_id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return log;
}

/**
 * A failed render is not the end of the production: the assembly step is put
 * back in the queue so the next tick can try again (or use another renderer).
 */
export async function retryRender(jobId: string, reason: string) {
  const { data: attempt } = await supabaseAdmin
    .from("job_steps")
    .select("attempts")
    .eq("job_id", jobId)
    .eq("step", "render_video")
    .maybeSingle();

  if ((attempt?.attempts ?? 0) >= 3) {
    await failRender(jobId, reason);
    return;
  }

  await supabaseAdmin
    .from("videos")
    .update({ render_status: "pending", render_job_id: null })
    .eq("job_id", jobId);
  await supabaseAdmin
    .from("job_steps")
    .update({ status: "pending", detail: `إعادة المحاولة: ${reason}` })
    .eq("job_id", jobId)
    .eq("step", "render_video");
  await supabaseAdmin
    .from("production_jobs")
    .update({
      status: "queued",
      paused_reason: null,
      paused_at: null,
      next_run_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}
