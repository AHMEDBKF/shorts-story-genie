import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Youtube } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  disconnectYoutube,
  getYoutubeAuthUrl,
  getYoutubeStatus,
} from "@/lib/youtube.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات | Kids Shorts AI" },
      {
        name: "description",
        content: "تحكم في وضع التكلفة المنخفضة، الجدولة الأسبوعية، مزوّدي الذكاء الاصطناعي، وربط يوتيوب.",
      },
      { property: "og:title", content: "الإعدادات | Kids Shorts AI" },
      { property: "og:description", content: "إعدادات الإنتاج التلقائي والربط بيوتيوب." },
    ],
  }),
  component: SettingsPage,
});

const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function SettingsPage() {
  const { loading, userId } = useRequireAuth();
  const queryClient = useQueryClient();
  const authUrlFn = useServerFn(getYoutubeAuthUrl);
  const disconnectFn = useServerFn(disconnectYoutube);
  const statusFn = useServerFn(getYoutubeStatus);

  const profile = useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const schedule = useQuery({
    queryKey: ["schedule", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_schedules")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const providers = useQuery({
    queryKey: ["providers-settings", userId],
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
    queryFn: () => statusFn(),
  });

  const updateProfile = useMutation({
    mutationFn: async (patch: { low_cost_mode?: boolean; default_language?: string }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const upsertSchedule = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase
        .from("automation_schedules")
        .upsert({ user_id: userId!, ...schedule.data, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الجدولة");
      void queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
  });

  const toggleProvider = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("ai_providers").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["providers-settings"] }),
  });

  if (loading) return <AppShell>…</AppShell>;

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">الإعدادات</h1>

      <Card className="mt-6 rounded-3xl">
        <CardHeader>
          <CardTitle className="font-display text-base">الإنتاج</CardTitle>
          <CardDescription>
            وضع التكلفة المنخفضة يستخدم المزوّدين المجانيين فقط ولا يستهلك أي خدمة مدفوعة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="low-cost">وضع التكلفة المنخفضة</Label>
            <Switch
              id="low-cost"
              checked={profile.data?.low_cost_mode ?? true}
              onCheckedChange={(checked) => updateProfile.mutate({ low_cost_mode: checked })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            لن يُستخدم أي مزوّد مدفوع إلا بعد الموافقة عليه صراحة من قائمة المزوّدين بالأسفل.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-3xl">
        <CardHeader>
          <CardTitle className="font-display text-base">الجدولة الأسبوعية</CardTitle>
          <CardDescription>ينشئ النظام فيديو جديداً تلقائياً كل أسبوع.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="auto">تشغيل الجدولة</Label>
            <Switch
              id="auto"
              checked={schedule.data?.enabled ?? false}
              onCheckedChange={(checked) => upsertSchedule.mutate({ enabled: checked })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>اليوم</Label>
              <Select
                value={String(schedule.data?.day_of_week ?? 6)}
                onValueChange={(value) => upsertSchedule.mutate({ day_of_week: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day, index) => (
                    <SelectItem key={day} value={String(index)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الساعة (بتوقيت UTC)</Label>
              <Select
                value={String(schedule.data?.hour_utc ?? 6)}
                onValueChange={(value) => upsertSchedule.mutate({ hour_utc: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <SelectItem key={hour} value={String(hour)}>
                      {String(hour).padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Youtube className="size-4" /> يوتيوب
          </CardTitle>
          <CardDescription>كل الرفع يتم بخصوصية «خاص» افتراضياً.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {youtube.data?.connected ? (
            <>
              <p className="text-sm">
                مرتبط بالقناة: <strong>{youtube.data.channelTitle ?? "قناتك"}</strong>
              </p>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={async () => {
                  await disconnectFn();
                  toast.success("تم فصل القناة");
                  void queryClient.invalidateQueries({ queryKey: ["youtube-status"] });
                }}
              >
                فصل القناة
              </Button>
            </>
          ) : (
            <Button
              className="rounded-2xl"
              onClick={async () => {
                try {
                  const { url } = await authUrlFn();
                  window.location.href = url;
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "الربط بيوتيوب غير مهيأ بعد",
                  );
                }
              }}
            >
              ربط قناة يوتيوب
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-3xl">
        <CardHeader>
          <CardTitle className="font-display text-base">مزوّدو الذكاء الاصطناعي</CardTitle>
          <CardDescription>
            المزوّدون التجريبيون يعملون الآن. عند إضافة مفاتيح حقيقية يمكن تفعيل البدائل هنا.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {providers.data?.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/50 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{provider.label}</p>
                <p className="text-xs text-muted-foreground">
                  {provider.capability} — {provider.cost_tier === "free" ? "مجاني" : "مدفوع"}
                </p>
              </div>
              <Switch
                checked={provider.enabled}
                onCheckedChange={(checked) =>
                  toggleProvider.mutate({ id: provider.id, enabled: checked })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
