import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Starts a new production and immediately advances the first steps. */
export const startProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ prompt: z.string().trim().max(300).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createProductionJob } = await import("@/lib/pipeline/pipeline.server");
    const { runWorkerTick } = await import("@/lib/pipeline/worker.server");

    const { data: active } = await supabaseAdmin
      .from("production_jobs")
      .select("id")
      .eq("user_id", context.userId)
      .in("status", ["queued", "running"])
      .limit(1);
    if ((active?.length ?? 0) > 0) {
      return { jobId: active![0]!.id, alreadyRunning: true };
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("low_cost_mode, default_language")
      .eq("id", context.userId)
      .maybeSingle();

    const jobId = await createProductionJob(context.userId, {
      prompt: data.prompt || null,
      lowCostMode: profile?.low_cost_mode ?? true,
      language: profile?.default_language ?? "ar",
    });

    await runWorkerTick();
    return { jobId, alreadyRunning: false };
  });

/** Advances pipeline work. Called by the dashboard while a job is active. */
export const advanceProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { runWorkerTick } = await import("@/lib/pipeline/worker.server");
    return runWorkerTick();
  });

/** Clears a paused/failed job so the worker retries the failed step. */
export const retryProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runWorkerTick } = await import("@/lib/pipeline/worker.server");

    const { data: job } = await supabaseAdmin
      .from("production_jobs")
      .select("id, user_id")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job || job.user_id !== context.userId) throw new Error("Not found");

    await supabaseAdmin
      .from("job_steps")
      .update({ status: "pending", attempts: 0 })
      .eq("job_id", job.id)
      .eq("status", "failed");
    await supabaseAdmin
      .from("production_jobs")
      .update({
        status: "running",
        paused_reason: null,
        paused_at: null,
        last_error: null,
        attempts: 0,
        next_run_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    await supabaseAdmin
      .from("failed_jobs")
      .update({ resolved: true })
      .eq("job_id", job.id)
      .eq("resolved", false);

    await runWorkerTick();
    return { ok: true };
  });

export const cancelProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("production_jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.jobId)
      .eq("user_id", context.userId);
    return { ok: true };
  });
