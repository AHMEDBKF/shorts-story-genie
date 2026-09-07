import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { NoProviderError } from "@/lib/providers/router.server";
import { STEPS, STEP_RUNNERS, type StepName } from "./pipeline.server";

const LOCK_KEY = "production-worker";
const LOCK_SECONDS = 120;
const MAX_STEPS_PER_TICK = 14;
const MAX_ATTEMPTS = 3;

async function acquireLock(holder: string) {
  const now = new Date();
  const until = new Date(now.getTime() + LOCK_SECONDS * 1000).toISOString();
  const { data: existing } = await supabaseAdmin
    .from("job_locks")
    .select("key, locked_until")
    .eq("key", LOCK_KEY)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabaseAdmin
      .from("job_locks")
      .insert({ key: LOCK_KEY, holder, locked_until: until });
    return !error;
  }
  if (new Date(existing.locked_until) > now) return false;

  const { data, error } = await supabaseAdmin
    .from("job_locks")
    .update({ holder, locked_until: until })
    .eq("key", LOCK_KEY)
    .lte("locked_until", now.toISOString())
    .select("key");
  return !error && (data?.length ?? 0) > 0;
}

async function releaseLock() {
  await supabaseAdmin
    .from("job_locks")
    .update({ locked_until: new Date().toISOString() })
    .eq("key", LOCK_KEY);
}

/** Runs a bounded amount of pipeline work. Safe to call on any schedule. */
export async function runWorkerTick() {
  const holder = crypto.randomUUID();
  if (!(await acquireLock(holder))) {
    return { ran: false, reason: "another worker is running" };
  }

  const log: string[] = [];
  try {
    for (let i = 0; i < MAX_STEPS_PER_TICK; i += 1) {
      const { data: job } = await supabaseAdmin
        .from("production_jobs")
        .select("id, user_id, language, low_cost_mode, request_prompt, topic_id, status")
        .in("status", ["queued", "running"])
        .lte("next_run_at", new Date().toISOString())
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!job) {
        log.push("no pending jobs");
        break;
      }

      const { data: step } = await supabaseAdmin
        .from("job_steps")
        .select("id, step, position, attempts, status")
        .eq("job_id", job.id)
        .in("status", ["pending", "running", "failed"])
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!step) {
        const { data: blocked } = await supabaseAdmin
          .from("job_steps")
          .select("step, detail")
          .eq("job_id", job.id)
          .eq("status", "blocked")
          .order("position", { ascending: true });

        if ((blocked?.length ?? 0) > 0) {
          const reason = blocked?.map((row) => row.detail).filter(Boolean).join(" — ") ?? "";
          await supabaseAdmin
            .from("production_jobs")
            .update({
              status: "paused",
              progress: 100,
              paused_reason: reason || "بانتظار خطوة خارجية.",
              paused_at: new Date().toISOString(),
              finished_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          log.push(`job ${job.id} waiting: ${reason}`);
          continue;
        }

        await supabaseAdmin
          .from("production_jobs")
          .update({ status: "completed", progress: 100, finished_at: new Date().toISOString() })
          .eq("id", job.id);
        log.push(`job ${job.id} completed`);
        continue;
      }


      await supabaseAdmin
        .from("production_jobs")
        .update({
          status: "running",
          current_step: step.step,
          started_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .is("started_at", null);
      await supabaseAdmin
        .from("production_jobs")
        .update({ status: "running", current_step: step.step })
        .eq("id", job.id);
      await supabaseAdmin
        .from("job_steps")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", step.id);

      try {
        const result = await STEP_RUNNERS[step.step as StepName]({
          id: job.id,
          user_id: job.user_id,
          language: job.language,
          low_cost_mode: job.low_cost_mode,
          request_prompt: job.request_prompt,
          topic_id: job.topic_id,
        });

        if (result.done) {
          await supabaseAdmin
            .from("job_steps")
            .update({
              status: result.blocked ? "blocked" : "completed",
              detail: result.detail,
              completed_at: new Date().toISOString(),
            })
            .eq("id", step.id);
        } else {
          await supabaseAdmin
            .from("job_steps")
            .update({ status: "pending", detail: result.detail })
            .eq("id", step.id);
        }

        const progress = Math.round(
          (STEPS.indexOf(step.step as StepName) + (result.done ? 1 : 0.5)) * (100 / STEPS.length),
        );
        await supabaseAdmin
          .from("production_jobs")
          .update({ progress, last_error: null, next_run_at: new Date().toISOString() })
          .eq("id", job.id);
        log.push(`${job.id}:${step.step} → ${result.detail}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const attempts = (step.attempts ?? 0) + 1;
        const terminal = error instanceof NoProviderError || attempts >= MAX_ATTEMPTS;

        await supabaseAdmin
          .from("job_steps")
          .update({
            status: terminal ? "failed" : "pending",
            attempts,
            detail: message,
          })
          .eq("id", step.id);
        await supabaseAdmin.from("failed_jobs").insert({
          job_id: job.id,
          user_id: job.user_id,
          step: step.step,
          error: message,
        });
        await supabaseAdmin
          .from("production_jobs")
          .update({
            status: terminal ? "paused" : "running",
            paused_reason: terminal ? message : null,
            paused_at: terminal ? new Date().toISOString() : null,
            last_error: message,
            attempts,
            next_run_at: new Date(Date.now() + (terminal ? 0 : 30_000)).toISOString(),
          })
          .eq("id", job.id);
        log.push(`${job.id}:${step.step} failed → ${message}`);
        break;
      }
    }
  } finally {
    await releaseLock();
  }

  return { ran: true, log };
}
