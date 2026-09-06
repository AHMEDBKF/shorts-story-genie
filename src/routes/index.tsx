import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Loader2,
  PauseCircle,
  RotateCcw,
  Sparkles,
  Youtube,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { STEP_LABELS, STEP_ORDER } from "@/lib/steps";
import {
  advanceProduction,
  retryProduction,
  startProduction,
} from "@/lib/production.functions";
import { getYoutubeStatus } from "@/lib/youtube.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kids Shorts AI — قصص أطفال قصيرة تلقائياً" },
      {
        name: "description",
        content:
          "اضغط زراً واحداً ليقوم النظام تلقائياً بكتابة قصة أطفال عربية، وتقسيمها لمشاهد، وتوليد الصور والأصوات والترجمة، وتجهيزها للرفع على يوتيوب.",
      },
      { property: "og:title", content: "Kids Shorts AI — قصص أطفال قصيرة تلقائياً" },
      {
        property: "og:description",
        content:
          "مصنع تلقائي لفيديوهات يوتيوب شورتس التعليمية للأطفال بالعربية: قصة، مشاهد، صور، أصوات، ترجمة، ورفع خاص.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const STATUS_LABELS: Record<string, string> = {
  queued: "في الانتظار",
  running: "قيد التنفيذ",
  paused: "متوقف مؤقتاً",
  completed: "مكتمل",
  failed: "فشل",
  cancelled: "ملغى",
};

function Dashboard() {
  const { loading, userId } = useRequireAuth();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");

  const start = useServerFn(startProduction);
  const advance = useServerFn(advanceProduction);
  const retry = useServerFn(retryProduction);
  const youtubeStatusFn = useServerFn(getYoutubeStatus);

  const jobs = useQuery({
    queryKey: ["jobs", userId],
    enabled: Boolean(userId),
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_jobs")
        .select("*, topics(title), stories(title), videos(title, render_status)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const activeJob = jobs.data?.find((job) =>
    ["queued", "running", "paused"].includes(job.status),
  );

  const steps = useQuery({
    queryKey: ["job-steps", activeJob?.id],
    enabled: Boolean(activeJob?.id),
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_steps")
        .select("*")
        .eq("job_id", activeJob!.id)
        .order("position");
      if (error) throw error;
      return data;
    },
  });

  const failures = useQuery({
    queryKey: ["failures", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("failed_jobs")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const providers = useQuery({
    queryKey: ["providers", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_providers")
        .select("*")
        .order("capability")
        .order("priority");
      if (error) throw error;
      return data;
    },
  });

  const youtube = useQuery({
    queryKey: ["youtube-status", userId],
    enabled: Boolean(userId),
    queryFn: () => youtubeStatusFn(),
  });

  // Keep the pipeline moving while the page is open; the scheduled worker
  // continues the same job when the browser is closed.
  useEffect(() => {
    if (!activeJob || activeJob.status === "paused") return;
    let cancelled = false;
    const timer = setInterval(() => {
      void advance().then(() => {
        if (!cancelled) {
          void queryClient.invalidateQueries({ queryKey: ["jobs"] });
          void queryClient.invalidateQueries({ queryKey: ["job-steps"] });
        }
      });
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeJob, advance, queryClient]);

  const startMutation = useMutation({
    mutationFn: () => start({ data: { prompt: prompt.trim() || undefined } }),
    onSuccess: (result) => {
      setPrompt("");
      toast.success(
        result.alreadyRunning ? "هناك إنتاج جارٍ بالفعل." : "بدأ الإنتاج! يمكنك إغلاق التطبيق.",
      );
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر البدء"),
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => retry({ data: { jobId } }),
    onSuccess: () => {
      toast.success("تمت إعادة المحاولة");
      void queryClient.invalidateQueries();
    },
  });

  if (loading) {
    return (
      <AppShell>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </AppShell>
    );
  }

  const completed = jobs.data?.filter((job) => job.status === "completed") ?? [];

  return (
    <AppShell>
      <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          فيديو جديد بضغطة واحدة
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          اضغط الزر ثم أغلق التطبيق. سيكمل النظام كتابة القصة وتوليد المشاهد والصور والأصوات
          والترجمة في الخلفية، حتى لو استغرق الأمر ساعات.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            size="lg"
            className="h-16 rounded-3xl text-lg font-bold shadow-md"
            disabled={startMutation.isPending || Boolean(activeJob)}
            onClick={() => startMutation.mutate()}
          >
            {startMutation.isPending ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <Sparkles className="size-6" />
            )}
            إنشاء فيديو هذا الأسبوع
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              className="h-12 rounded-2xl"
              placeholder="أو اكتب طلباً: قصة قصيرة للأطفال عن الصدق"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <Button
              variant="secondary"
              className="h-12 rounded-2xl"
              disabled={startMutation.isPending || Boolean(activeJob) || !prompt.trim()}
              onClick={() => startMutation.mutate()}
            >
              إنشاء بهذا الطلب
            </Button>
          </div>
          {activeJob ? (
            <p className="text-xs text-muted-foreground">
              يوجد إنتاج جارٍ الآن — سيتاح الزر بعد انتهائه.
            </p>
          ) : null}
        </div>
      </section>

      {activeJob ? (
        <Card className="mt-6 rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="font-display text-lg">
              {(activeJob.stories as { title: string } | null)?.title ??
                (activeJob.topics as { title: string } | null)?.title ??
                "إنتاج جديد"}
            </CardTitle>
            <Badge variant={activeJob.status === "paused" ? "destructive" : "secondary"}>
              {STATUS_LABELS[activeJob.status]}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={activeJob.progress} className="h-3" />
            {activeJob.paused_reason ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                <span className="flex-1">{activeJob.paused_reason}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => retryMutation.mutate(activeJob.id)}
                >
                  <RotateCcw className="size-4" /> إعادة المحاولة
                </Button>
              </div>
            ) : null}

            <ol className="space-y-2">
              {STEP_ORDER.map((step) => {
                const row = steps.data?.find((item) => item.step === step);
                const status = row?.status ?? "pending";
                return (
                  <li
                    key={step}
                    className="flex items-start gap-3 rounded-2xl bg-secondary/50 px-3 py-2"
                  >
                    <StatusIcon status={status} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{STEP_LABELS[step]}</p>
                      {row?.detail ? (
                        <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="فيديوهات مكتملة" value={completed.length} />
        <StatCard
          label="مهام قيد الانتظار"
          value={jobs.data?.filter((job) => ["queued", "running"].includes(job.status)).length ?? 0}
        />
        <StatCard label="مهام فاشلة" value={failures.data?.length ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="font-display text-base">حالة المزوّدين</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {providers.data?.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between rounded-2xl bg-secondary/50 px-3 py-2 text-sm"
              >
                <span>{provider.label}</span>
                <Badge variant={provider.status === "error" ? "destructive" : "outline"}>
                  {provider.status === "error" ? "خطأ" : "جاهز"}
                </Badge>
              </div>
            )) ?? <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <Youtube className="size-4" /> يوتيوب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {youtube.data?.connected ? (
              <p>
                القناة المرتبطة: <strong>{youtube.data.channelTitle ?? "قناتك"}</strong>
              </p>
            ) : (
              <p className="text-muted-foreground">
                لم تربط قناة يوتيوب بعد. الرفع الافتراضي سيكون «خاص».
              </p>
            )}
            <Button asChild variant="secondary" size="sm" className="rounded-2xl">
              <Link to="/settings">إدارة الربط</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {completed.length > 0 ? (
        <Card className="mt-6 rounded-3xl">
          <CardHeader>
            <CardTitle className="font-display text-base">آخر الفيديوهات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {completed.slice(0, 4).map((job) => (
              <Link
                key={job.id}
                to="/videos/$jobId"
                params={{ jobId: job.id }}
                className="flex items-center justify-between rounded-2xl bg-secondary/50 px-3 py-2 text-sm hover:bg-secondary"
              >
                <span className="truncate">
                  {(job.videos as { title: string } | null)?.title ??
                    (job.stories as { title: string } | null)?.title ??
                    "فيديو"}
                </span>
                <span className="text-xs text-muted-foreground">عرض</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-3xl">
      <CardContent className="p-4">
        <p className="font-display text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="mt-0.5 size-5 text-mint" />;
  if (status === "running") return <Loader2 className="mt-0.5 size-5 animate-spin text-primary" />;
  if (status === "failed") return <AlertTriangle className="mt-0.5 size-5 text-destructive" />;
  if (status === "blocked") return <PauseCircle className="mt-0.5 size-5 text-sunny" />;
  if (status === "skipped") return <Clock className="mt-0.5 size-5 text-muted-foreground" />;
  return <CircleDashed className="mt-0.5 size-5 text-muted-foreground" />;
}
