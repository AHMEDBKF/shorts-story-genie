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
  const { completeRender, retryRender } = await import("@/lib/render/complete.server");
  const { data: job } = await supabaseAdmin
    .from("production_jobs")
    .select("id, user_id")
    .eq("id", body.jobId)
    .maybeSingle();
  if (!job) return Response.json({ error: "job not found" }, { status: 404 });

  if (body.error) {
    await retryRender(job.id, body.error);
    return Response.json({ ok: true, status: "failed" });
  }

  if (!body.videoUrl) {
    return Response.json({ error: "videoUrl or error is required" }, { status: 400 });
  }

  const stored = await completeRender(job.id, job.user_id, body.videoUrl);
  if (!stored.ok) return Response.json({ error: stored.error }, { status: stored.status });
  return Response.json({ ok: true, status: "rendered", storagePath: stored.storagePath });
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
