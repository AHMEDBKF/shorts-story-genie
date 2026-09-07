import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Entry point for an external video-assembly service (FFmpeg worker).
 * It sends the finished MP4 back here; the production then resumes on its own
 * and continues to the YouTube upload step.
 */
async function handle(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    jobId?: string;
    videoUrl?: string;
    error?: string;
  } | null;

  if (!body?.jobId) {
    return Response.json({ error: "jobId is required" }, { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: job } = await supabaseAdmin
    .from("production_jobs")
    .select("id, user_id")
    .eq("id", body.jobId)
    .maybeSingle();
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  if (body.error) {
    await supabaseAdmin
      .from("videos")
      .update({ render_status: "failed" })
      .eq("job_id", job.id);
    await supabaseAdmin
      .from("production_jobs")
      .update({ status: "paused", paused_reason: body.error, paused_at: new Date().toISOString() })
      .eq("id", job.id);
    return Response.json({ ok: true, status: "failed" });
  }

  if (!body.videoUrl) {
    return Response.json({ error: "videoUrl or error is required" }, { status: 400 });
  }

  const source = await fetch(body.videoUrl);
  if (!source.ok) {
    return Response.json({ error: `could not fetch video (${source.status})` }, { status: 400 });
  }
  const bytes = new Uint8Array(await source.arrayBuffer());
  const path = `${job.user_id}/${job.id}/final.mp4`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("media")
    .upload(path, bytes, { contentType: "video/mp4", upsert: true });
  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 });

  await supabaseAdmin
    .from("videos")
    .update({ storage_path: path, render_status: "rendered" })
    .eq("job_id", job.id);

  // Resume the production: the render step is done, the upload step runs next.
  await supabaseAdmin
    .from("job_steps")
    .update({ status: "completed", detail: "تم استلام الفيديو النهائي." })
    .eq("job_id", job.id)
    .eq("step", "render_video");
  await supabaseAdmin
    .from("job_steps")
    .update({ status: "pending", detail: null, attempts: 0 })
    .eq("job_id", job.id)
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
    .eq("id", job.id);

  return Response.json({ ok: true, status: "rendered", storagePath: path });
}

export const Route = createFileRoute("/api/public/render-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        return handle(request);
      },
    },
  },
});
