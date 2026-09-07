import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface RendererCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * Verifies a self-hosted FFmpeg renderer: reachability, authentication,
 * health report, and whether it accepts (and cancels) a test job.
 */
export const testFfmpegRenderer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; checks: RendererCheck[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("ffmpeg_worker_url")
      .eq("id", context.userId)
      .maybeSingle();

    const base = (profile?.ffmpeg_worker_url ?? "").trim().replace(/\/+$/, "");
    const token = process.env["FFMPEG_WORKER_TOKEN"];
    const checks: RendererCheck[] = [];

    if (!base) {
      return {
        ok: false,
        checks: [{ name: "العنوان", ok: false, detail: "لم تُدخل عنوان المُركِّب بعد." }],
      };
    }
    if (!token) {
      return {
        ok: false,
        checks: [{ name: "المفتاح", ok: false, detail: "لم يُضبط مفتاح المُركِّب في الخادم." }],
      };
    }

    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    };

    // 1 + 2 + 3 — reachability, authentication, health
    let health: Response | null = null;
    try {
      health = await fetch(`${base}/health`, { headers });
      checks.push({ name: "الاتصال", ok: true, detail: `استجاب المُركِّب (${health.status}).` });
    } catch (error) {
      checks.push({
        name: "الاتصال",
        ok: false,
        detail: `تعذّر الوصول: ${error instanceof Error ? error.message : String(error)}`,
      });
      return { ok: false, checks };
    }

    checks.push({
      name: "التوثيق",
      ok: health.status !== 401 && health.status !== 403,
      detail:
        health.status === 401 || health.status === 403
          ? "المفتاح مرفوض من المُركِّب."
          : "المفتاح مقبول.",
    });

    const healthBody = (await health.json().catch(() => null)) as
      | { status?: string; ffmpeg?: string }
      | null;
    checks.push({
      name: "الحالة",
      ok: health.ok && healthBody?.status === "healthy",
      detail: health.ok
        ? `الحالة: ${healthBody?.status ?? "غير معروفة"}${healthBody?.ffmpeg ? ` — FFmpeg ${healthBody.ffmpeg}` : ""}`
        : `رد غير سليم (${health.status}).`,
    });

    // 4 — accepts a test job
    try {
      const { APP_BASE_URL } = await import("@/lib/render/timeline.server");
      const probe = await fetch(`${base}/render`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jobId: `test-${crypto.randomUUID()}`,
          callbackUrl: `${APP_BASE_URL}/api/public/render-callback`,
          callbackToken: token,
          test: true,
          output: { format: "mp4", codec: "h264", width: 1080, height: 1920, fps: 25 },
          subtitles: { burnIn: true, language: "ar", direction: "rtl" },
          kenBurns: { enabled: true, intensity: 0.12 },
          timeline: {
            jobId: "test",
            width: 1080,
            height: 1920,
            fps: 25,
            totalSeconds: 1,
            scenes: [],
            subtitlesVtt: null,
            musicUrl: null,
          },
        }),
      });
      const body = (await probe.json().catch(() => null)) as
        | { renderId?: string; error?: string }
        | null;
      const accepted = probe.ok && Boolean(body?.renderId);
      checks.push({
        name: "قبول مهمة تجريبية",
        ok: accepted,
        detail: accepted
          ? `تم قبول المهمة (${body?.renderId}).`
          : `رُفضت المهمة (${probe.status}): ${body?.error ?? ""}`.trim(),
      });
      if (accepted && body?.renderId) {
        await fetch(`${base}/render/${encodeURIComponent(body.renderId)}/cancel`, {
          method: "POST",
          headers,
        }).catch(() => null);
      }
    } catch (error) {
      checks.push({
        name: "قبول مهمة تجريبية",
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }

    return { ok: checks.every((check) => check.ok), checks };
  });
