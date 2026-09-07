import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Entry point for an external video-assembly service (self-hosted FFmpeg worker).
 * It reports progress, sends the finished MP4, or reports a failure; the
 * production then resumes on its own and continues to the YouTube upload step.
 */
async function handle(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    jobId?: string;
    renderId?: string;
    status?: string;
    progress?: number;
    videoUrl?: string;
    url?: string;
    error?: string;
  } | null;

  if (!body?.jobId) {
    return Response.json({ error: "jobId is required" }, { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { completeRender, retryRender } = await import("@/lib/render/complete.server");
  const { data: job } = await supabaseAdmin
    .from("production_jobs")
    .select("id, user_id")
    .eq("id", body.jobId)
    .maybeSingle();
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  if (body.error || body.status === "failed" || body.status === "cancelled") {
    await retryRender(job.id, body.error ?? "فشل التركيب في مُركِّب FFmpeg.");
    return Response.json({ ok: true, status: "failed" });
  }

  const videoUrl = body.videoUrl ?? body.url;
  if (!videoUrl) {
    // Progress ping: record it without changing the pipeline state.
    if (typeof body.progress === "number") {
      await supabaseAdmin
        .from("job_steps")
        .update({ detail: `جاري التركيب… ${Math.round(body.progress)}%` })
        .eq("job_id", job.id)
        .eq("step", "render_video");
      return Response.json({ ok: true, status: "processing" });
    }
    return Response.json({ error: "videoUrl or error is required" }, { status: 400 });
  }

  const stored = await completeRender(job.id, job.user_id, videoUrl);
  if (!stored.ok) return Response.json({ error: stored.error }, { status: stored.status });
  return Response.json({ ok: true, status: "rendered", storagePath: stored.storagePath });
}

/** The renderer authenticates with its own worker token; cron uses its secret. */
async function authenticate(request: Request): Promise<Response | null> {
  const token = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  const workerToken = process.env["FFMPEG_WORKER_TOKEN"];
  if (token && workerToken && token === workerToken) return null;
  return authenticateCronRequest(request);
}

export const Route = createFileRoute("/api/public/render-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticate(request);
        if (denied) return denied;
        return handle(request);
      },
    },
  },
});
