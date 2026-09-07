import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Star, Trash2, UserRound, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CharactersPage,
});

const EMPTY = {
  name: "",
  description: "",
  personality: "",
  appearance: "",
  clothes: "",
  visual_style: "رسوم كرتونية ثلاثية الأبعاد ناعمة بألوان دافئة",
  reference_image_url: "",
  is_default: true,
};

type Form = typeof EMPTY;

function CharactersPage() {
  const { loading, userId } = useRequireAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const characters = useQuery({
    queryKey: ["characters", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, name: form.name.trim() };
      if (editingId) {
        const { error } = await supabase
          .from("characters")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("characters")
        .insert({ ...payload, user_id: userId! });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editingId ? "تم تحديث الشخصية" : "تمت إضافة الشخصية");
      reset();
      void queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر الحفظ"),
  });

  const toggleDefault = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from("characters")
        .update({ is_default: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["characters"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("characters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      if (editingId === id) reset();
      void queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });

  if (loading) return <AppShell>…</AppShell>;

  const chosen = (characters.data ?? []).filter((character) => character.is_default);
  const cast = (chosen.length ? chosen : (characters.data ?? [])).slice(0, 4);

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">مكتبة الشخصيات</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        الشخصيات المفعّلة تدخل تلقائياً في كل قصة جديدة، وتظهر بنفس الشكل والملابس في كل
        المشاهد وكل الفيديوهات.
      </p>

      {cast.length > 0 && (
        <p className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-sm">
          أبطال القصة القادمة:{" "}
          <span className="font-bold">{cast.map((c) => c.name).join("، ")}</span>
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card className="rounded-3xl">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-display text-base">
              {editingId ? "تعديل الشخصية" : "شخصية جديدة"}
            </CardTitle>
            {editingId && (
              <Button size="sm" variant="ghost" onClick={reset}>
                <X className="size-4" /> إلغاء
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="الاسم">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="الوصف العام">
              <Textarea
                rows={2}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
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
            <div className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
              <Label htmlFor="is-default">استخدامها في القصص الجديدة</Label>
              <Switch
                id="is-default"
                checked={form.is_default}
                onCheckedChange={(value) => setForm({ ...form, is_default: value })}
              />
            </div>
            <Button
              className="w-full rounded-2xl"
              disabled={!form.name.trim() || save.isPending}
              onClick={() => save.mutate()}
            >
              {editingId ? (
                <>
                  <Pencil className="size-4" /> حفظ التعديل
                </>
              ) : (
                <>
                  <Plus className="size-4" /> إضافة
                </>
              )}
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
                    <p className="flex items-center gap-2 font-display font-bold">
                      {character.name}
                      {character.is_default && (
                        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                          <Star className="size-3" /> مفعّلة
                        </span>
                      )}
                    </p>
                    {character.description && (
                      <p className="text-sm text-muted-foreground">{character.description}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{character.personality}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{character.appearance}</p>
                    <p className="text-xs text-muted-foreground">{character.clothes}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Switch
                        checked={character.is_default}
                        aria-label={`تفعيل ${character.name} في القصص`}
                        onCheckedChange={(value) =>
                          toggleDefault.mutate({ id: character.id, value })
                        }
                      />
                      <span className="text-xs text-muted-foreground">استخدامها في القصص</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="تعديل الشخصية"
                      onClick={() => {
                        setEditingId(character.id);
                        setForm({
                          name: character.name ?? "",
                          description: character.description ?? "",
                          personality: character.personality ?? "",
                          appearance: character.appearance ?? "",
                          clothes: character.clothes ?? "",
                          visual_style: character.visual_style ?? "",
                          reference_image_url: character.reference_image_url ?? "",
                          is_default: character.is_default,
                        });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="حذف الشخصية"
                      onClick={() => remove.mutate(character.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
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
