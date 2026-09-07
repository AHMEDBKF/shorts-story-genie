import { createFileRoute } from "@tanstack/react-router";

/**
 * The external assembly service calls this when a video is finished or failed.
 * The unguessable render id is matched against a stored production before
 * anything is accepted.
 */
async function handle(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: string;
    url?: string;
    error?: string;
  } | null;

  if (!body?.id) return Response.json({ error: "id is required" }, { status: 400 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { completeRender, failRender } = await import("@/lib/render/complete.server");

  const { data: video } = await supabaseAdmin
    .from("videos")
    .select("job_id, user_id")
    .eq("render_job_id", body.id)
    .maybeSingle();
  if (!video) return Response.json({ error: "unknown render" }, { status: 404 });

  if (body.status === "failed" || body.error) {
    await failRender(video.job_id, body.error ?? "فشل التركيب النهائي.");
    return Response.json({ ok: true, status: "failed" });
  }

  if (body.status !== "done" || !body.url) {
    return Response.json({ ok: true, status: body.status ?? "pending" });
  }

  const stored = await completeRender(video.job_id, video.user_id, body.url);
  if (!stored.ok) return Response.json({ error: stored.error }, { status: stored.status });
  return Response.json({ ok: true, status: "rendered", storagePath: stored.storagePath });
}

export const Route = createFileRoute("/api/public/shotstack-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
    },
  },
});
