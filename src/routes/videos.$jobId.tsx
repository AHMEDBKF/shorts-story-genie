import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/videos/$jobId")({
  head: () => ({
    meta: [
      { title: "تفاصيل الفيديو | Kids Shorts AI" },
      {
        name: "description",
        content: "القصة الكاملة، المشاهد، الصور، التعليق الصوتي، الترجمة، ونتائج فحص الجودة.",
      },
      { property: "og:title", content: "تفاصيل الفيديو | Kids Shorts AI" },
      { property: "og:description", content: "تفاصيل إنتاج فيديو أطفال قصير بالعربية." },
    ],
  }),
  component: VideoDetail,
});

type QualityReport = { passed: boolean; checks: { name: string; ok: boolean; detail: string }[] };

function VideoDetail() {
  const { jobId } = useParams({ from: "/videos/$jobId" });
  const { loading, userId } = useRequireAuth();

  const data = useQuery({
    queryKey: ["job-detail", jobId, userId],
    enabled: Boolean(userId),
    refetchInterval: 6000,
    queryFn: async () => {
      const [story, scenes, video, images, audio] = await Promise.all([
        supabase.from("stories").select("*").eq("job_id", jobId).maybeSingle(),
        supabase.from("scenes").select("*").eq("job_id", jobId).order("scene_number"),
        supabase.from("videos").select("*").eq("job_id", jobId).maybeSingle(),
        supabase.from("generated_images").select("scene_id, storage_path").eq("job_id", jobId),
        supabase.from("audio_files").select("scene_id, storage_path").eq("job_id", jobId),
      ]);

      const paths = [
        ...(images.data ?? []).map((row) => row.storage_path),
        ...(audio.data ?? []).map((row) => row.storage_path),
      ].filter(Boolean) as string[];
      const signed = paths.length
        ? await supabase.storage.from("media").createSignedUrls(paths, 3600)
        : { data: [] };
      const urls = new Map(
        (signed.data ?? []).map((item) => [item.path ?? "", item.signedUrl] as const),
      );

      return {
        story: story.data,
        scenes: scenes.data ?? [],
        video: video.data,
        imageBySceneId: new Map(
          (images.data ?? []).map((row) => [row.scene_id ?? "", urls.get(row.storage_path) ?? ""]),
        ),
        audioBySceneId: new Map(
          (audio.data ?? []).map((row) => [row.scene_id ?? "", urls.get(row.storage_path) ?? ""]),
        ),
      };
    },
  });

  if (loading || data.isLoading) return <AppShell>…</AppShell>;

  const video = data.data?.video;
  const report = video?.quality_report as QualityReport | null;

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">
        {video?.title ?? data.data?.story?.title ?? "تفاصيل الإنتاج"}
      </h1>
      {video?.description ? (
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
          {video.description}
        </p>
      ) : null}

      {video ? (
        <Card className="mt-6 rounded-3xl">
          <CardHeader>
            <CardTitle className="font-display text-base">حالة الفيديو النهائي</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              المقاس: {video.width}×{video.height} — المدة: {Math.round(video.duration_seconds ?? 0)}{" "}
              ثانية
            </p>
            {video.render_status === "awaiting_renderer" ? (
              <p className="rounded-2xl bg-sunny/20 p-3">
                كل المكوّنات جاهزة (صور، أصوات، ترجمة). تركيب الفيديو النهائي يحتاج خدمة تركيب
                خارجية لم يتم توصيلها بعد.
              </p>
            ) : (
              <Badge variant="outline">{video.render_status}</Badge>
            )}
          </CardContent>
        </Card>
      ) : null}

      {report ? (
        <Card className="mt-4 rounded-3xl">
          <CardHeader>
            <CardTitle className="font-display text-base">فحص الجودة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.checks.map((check) => (
              <div key={check.name} className="flex items-start gap-2 text-sm">
                {check.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 text-mint" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 text-destructive" />
                )}
                <span>{check.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <h2 className="mt-8 font-display text-xl font-bold">المشاهد</h2>
      <div className="mt-3 space-y-3">
        {data.data?.scenes.map((scene) => (
          <Card key={scene.id} className="rounded-3xl">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
              {data.data?.imageBySceneId.get(scene.id) ? (
                <img
                  src={data.data.imageBySceneId.get(scene.id)}
                  alt={`مشهد ${scene.scene_number}: ${scene.description}`}
                  loading="lazy"
                  className="h-56 w-32 shrink-0 rounded-2xl border border-border object-cover"
                />
              ) : (
                <div className="h-56 w-32 shrink-0 rounded-2xl bg-secondary" />
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-display font-bold">مشهد {scene.scene_number}</p>
                <p className="text-sm">{scene.description}</p>
                <p className="text-sm text-muted-foreground">{scene.narration}</p>
                {scene.dialogue ? (
                  <p className="text-sm text-muted-foreground">«{scene.dialogue}»</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  حركة: {scene.animation} — {scene.duration_seconds} ثانية
                </p>
                {data.data?.audioBySceneId.get(scene.id) ? (
                  <audio
                    controls
                    className="w-full"
                    src={data.data.audioBySceneId.get(scene.id)}
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {video?.subtitles_vtt ? (
        <Card className="mt-6 rounded-3xl">
          <CardHeader>
            <CardTitle className="font-display text-base">ملف الترجمة</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-secondary/60 p-3 text-xs">
              {video.subtitles_vtt}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </AppShell>
  );
}
