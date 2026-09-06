import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/characters")({
  head: () => ({
    meta: [
      { title: "مكتبة الشخصيات | Kids Shorts AI" },
      {
        name: "description",
        content:
          "عرّف شخصيات ثابتة بأسمائها وملابسها وأسلوبها البصري ليظهروا بنفس الشكل في كل فيديو.",
      },
      { property: "og:title", content: "مكتبة الشخصيات | Kids Shorts AI" },
      {
        property: "og:description",
        content: "شخصيات كرتونية ثابتة تُستخدم في كل قصة جديدة.",
      },
    ],
  }),
  component: CharactersPage,
});

const EMPTY = {
  name: "",
  personality: "",
  appearance: "",
  clothes: "",
  visual_style: "رسوم كرتونية ثلاثية الأبعاد ناعمة بألوان دافئة",
  reference_image_url: "",
};

function CharactersPage() {
  const { loading, userId } = useRequireAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);

  const characters = useQuery({
    queryKey: ["characters", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("characters")
        .insert({ ...form, user_id: userId! });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(EMPTY);
      toast.success("تمت إضافة الشخصية");
      void queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر الحفظ"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("characters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["characters"] }),
  });

  if (loading) return <AppShell>…</AppShell>;

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">مكتبة الشخصيات</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        الشخصيات المحفوظة هنا تُستخدم في كل قصة جديدة بنفس الشكل والملابس والأسلوب.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="font-display text-base">شخصية جديدة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="الاسم">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="الشخصية والطباع">
              <Input
                value={form.personality}
                onChange={(event) => setForm({ ...form, personality: event.target.value })}
              />
            </Field>
            <Field label="وصف الشكل">
              <Textarea
                rows={2}
                value={form.appearance}
                onChange={(event) => setForm({ ...form, appearance: event.target.value })}
              />
            </Field>
            <Field label="الملابس">
              <Input
                value={form.clothes}
                onChange={(event) => setForm({ ...form, clothes: event.target.value })}
              />
            </Field>
            <Field label="الأسلوب البصري">
              <Input
                value={form.visual_style}
                onChange={(event) => setForm({ ...form, visual_style: event.target.value })}
              />
            </Field>
            <Field label="رابط صورة مرجعية (اختياري)">
              <Input
                dir="ltr"
                value={form.reference_image_url}
                onChange={(event) =>
                  setForm({ ...form, reference_image_url: event.target.value })
                }
              />
            </Field>
            <Button
              className="w-full rounded-2xl"
              disabled={!form.name.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              <Plus className="size-4" /> إضافة
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {characters.data?.length ? (
            characters.data.map((character) => (
              <Card key={character.id} className="rounded-3xl">
                <CardContent className="flex gap-4 p-4">
                  {character.reference_image_url ? (
                    <img
                      src={character.reference_image_url}
                      alt={`صورة مرجعية للشخصية ${character.name}`}
                      className="size-16 rounded-2xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-secondary">
                      <UserRound className="size-7 text-muted-foreground" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold">{character.name}</p>
                    <p className="text-sm text-muted-foreground">{character.personality}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{character.appearance}</p>
                    <p className="text-xs text-muted-foreground">{character.clothes}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="حذف الشخصية"
                    onClick={() => remove.mutate(character.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="rounded-3xl">
              <CardContent className="p-6 text-sm text-muted-foreground">
                لا توجد شخصيات بعد. إذا لم تضف شخصيات، سيستخدم النظام «سمير» و«ليلى» تلقائياً.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
