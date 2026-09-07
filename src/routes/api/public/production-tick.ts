import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

async function handle() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { createProductionJob } = await import("@/lib/pipeline/pipeline.server");
  const { runWorkerTick } = await import("@/lib/pipeline/worker.server");

  const created: string[] = [];
  const now = new Date();

  // 1. Weekly automation: start a job when a schedule is due.
  const { data: schedules } = await supabaseAdmin
    .from("automation_schedules")
    .select("id, user_id, enabled, next_run_at, day_of_week, hour_utc")
    .eq("enabled", true);

  for (const schedule of schedules ?? []) {
    const due = !schedule.next_run_at || new Date(schedule.next_run_at) <= now;
    if (!due) continue;

    const { data: active } = await supabaseAdmin
      .from("production_jobs")
      .select("id")
      .eq("user_id", schedule.user_id)
      .in("status", ["queued", "running"])
      .limit(1);
    if ((active?.length ?? 0) > 0) continue;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("low_cost_mode, default_language")
      .eq("id", schedule.user_id)
      .maybeSingle();

    const jobId = await createProductionJob(schedule.user_id, {
      lowCostMode: profile?.low_cost_mode ?? true,
      language: profile?.default_language ?? "ar",
    });
    created.push(jobId);

    const next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await supabaseAdmin
      .from("automation_schedules")
      .update({ last_run_at: now.toISOString(), next_run_at: next.toISOString() })
      .eq("id", schedule.id);
  }

  // 2. Advance a bounded amount of pipeline work.
  const tick = await runWorkerTick();

  return new Response(JSON.stringify({ created, tick }), {
    headers: { "content-type": "application/json" },
  });
}

/**
 * Secondary caller check: the scheduled database job signs its request with a
 * token that only the database and this server can read.
 */
async function schedulerTokenMatches(request: Request): Promise<boolean> {
  const token = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return false;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("verify_worker_token", { _token: token });
  return !error && data === true;
}

export const Route = createFileRoute("/api/public/production-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) {
          if (!(await schedulerTokenMatches(request))) return denied;
        }
        return handle();
      },
    },
  },
});
