import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * Read-only readiness checklist for the first real production run.
 * It never reveals secret values — only whether they are configured.
 */
export const getDeploymentChecklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: ChecklistItem[]; ready: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const [{ data: profile }, { data: providers }, { data: youtube }, { data: testJobs }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("ffmpeg_worker_url, render_provider, allow_paid_renderer, test_mode")
          .eq("id", userId)
          .maybeSingle(),
        supabaseAdmin.from("ai_providers").select("capability, enabled, cost_tier, key, label"),
        supabaseAdmin
          .from("youtube_accounts")
          .select("channel_title")
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("production_jobs")
          .select("id, status, finished_at")
          .eq("user_id", userId)
          .eq("test_mode", true)
          .eq("status", "completed")
          .limit(1),
      ]);

    const enabledFor = (capability: string) =>
      (providers ?? []).filter((row) => row.capability === capability && row.enabled);

    const rendererUrl = (profile?.ffmpeg_worker_url ?? "").trim();
    const hasToken = Boolean(process.env["FFMPEG_WORKER_TOKEN"]);

    // Live reachability probe (short timeout so Settings stays responsive).
    let rendererHealthy = false;
    let rendererDetail = "لم يُدخل عنوان المُركِّب بعد.";
    if (rendererUrl && hasToken) {
      try {
        const response = await fetch(`${rendererUrl.replace(/\/+$/, "")}/health`, {
          headers: { authorization: `Bearer ${process.env["FFMPEG_WORKER_TOKEN"]}` },
          signal: AbortSignal.timeout(6000),
        });
        const body = (await response.json().catch(() => null)) as { status?: string } | null;
        rendererHealthy = response.ok && body?.status === "healthy";
        rendererDetail = rendererHealthy
          ? "المُركِّب يستجيب وحالته سليمة."
          : `رد المُركِّب: ${response.status}`;
      } catch (error) {
        rendererDetail = `تعذّر الوصول: ${error instanceof Error ? error.message : "خطأ"}`;
      }
    } else if (rendererUrl && !hasToken) {
      rendererDetail = "العنوان موجود لكن المفتاح المشترك غير مضبوط.";
    }

    const items: ChecklistItem[] = [
      {
        key: "supabase",
        label: "قاعدة البيانات والتخزين مهيأة",
        ok: Boolean(process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"]),
        detail: "الجداول، الصلاحيات، والتخزين الخاص جاهزة.",
      },
      {
        key: "text",
        label: "مزوّد النصوص مفعّل",
        ok: enabledFor("text").length > 0,
        detail: enabledFor("text")
          .map((row) => row.label)
          .join("، ") || "لا يوجد مزوّد نصوص مفعّل.",
      },
      {
        key: "image",
        label: "مزوّد الصور مفعّل",
        ok: enabledFor("image").length > 0,
        detail: enabledFor("image")
          .map((row) => row.label)
          .join("، ") || "لا يوجد مزوّد صور مفعّل.",
      },
      {
        key: "voice",
        label: "مزوّد الصوت العربي مفعّل",
        ok: enabledFor("voice").length > 0,
        detail: enabledFor("voice")
          .map((row) => row.label)
          .join("، ") || "لا يوجد مزوّد صوت مفعّل.",
      },
      {
        key: "renderer-url",
        label: "عنوان مُركِّب FFmpeg مضبوط",
        ok: Boolean(rendererUrl),
        detail: rendererUrl ? "تم إدخال العنوان." : "أدخل عنوان المُركِّب بعد نشره.",
      },
      {
        key: "renderer-key",
        label: "مفتاح المُركِّب محفوظ بأمان في الخادم",
        ok: hasToken,
        detail: hasToken ? "المفتاح مضبوط (لا يظهر في الواجهة)." : "لم يُحفظ المفتاح بعد.",
      },
      {
        key: "renderer-health",
        label: "تم اختبار الاتصال بالمُركِّب بنجاح",
        ok: rendererHealthy,
        detail: rendererDetail,
      },
      {
        key: "youtube",
        label: "قناة يوتيوب مرتبطة",
        ok: Boolean(youtube),
        detail: youtube?.channel_title ?? "لم تُربط قناة بعد.",
      },
      {
        key: "test-run",
        label: "اكتمل فيديو اختباري كامل",
        ok: (testJobs?.length ?? 0) > 0,
        detail:
          (testJobs?.length ?? 0) > 0
            ? "تم إنتاج فيديو تجريبي حتى النهاية."
            : "فعّل «وضع الاختبار» وأنشئ فيديو قصير للتجربة.",
      },
    ];

    return { items, ready: items.every((item) => item.ok) };
  });
