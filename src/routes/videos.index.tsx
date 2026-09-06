import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/videos/")({
  head: () => ({
    meta: [
      { title: "الفيديوهات | Kids Shorts AI" },
      {
        name: "description",
        content: "تابع كل الفيديوهات التي أنتجها النظام: القصة، المشاهد، الترجمة، وحالة الرفع.",
      },
      { property: "og:title", content: "الفيديوهات | Kids Shorts AI" },
      { property: "og:description", content: "أرشيف فيديوهات الأطفال المنتجة تلقائياً." },
    ],
  }),
  component: VideosPage,
});

const JOB_STATUS: Record<string, string> = {
  queued: "في الانتظار",
  running: "قيد التنفيذ",
  paused: "متوقف",
  completed: "مكتمل",
  failed: "فشل",
  cancelled: "ملغى",
};

function VideosPage() {
  const { loading, userId } = useRequireAuth();

  const jobs = useQuery({
    queryKey: ["all-jobs", userId],
    enabled: Boolean(userId),
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_jobs")
        .select("id, status, progress, created_at, stories(title), videos(title, render_status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (loading) return <AppShell>…</AppShell>;

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">الفيديوهات</h1>
      <p className="mt-1 text-sm text-muted-foreground">كل عمليات الإنتاج، الأحدث أولاً.</p>

      <div className="mt-6 space-y-3">
        {jobs.data?.length ? (
          jobs.data.map((job) => (
            <Link key={job.id} to="/videos/$jobId" params={{ jobId: job.id }}>
              <Card className="rounded-3xl transition-colors hover:bg-secondary/40">
                <CardContent className="flex items-center gap-4 p-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                    <Film className="size-5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-bold">
                      {(job.videos as { title: string } | null)?.title ??
                        (job.stories as { title: string } | null)?.title ??
                        "إنتاج بدون عنوان"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleString("ar")} — {job.progress}%
                    </p>
                  </div>
                  <Badge variant={job.status === "completed" ? "secondary" : "outline"}>
                    {JOB_STATUS[job.status] ?? job.status}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <Card className="rounded-3xl">
            <CardContent className="p-6 text-sm text-muted-foreground">
              لم تنتج أي فيديو بعد. ابدأ من لوحة التحكم.
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
