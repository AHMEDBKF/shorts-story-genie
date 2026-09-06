import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clapperboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | Kids Shorts AI" },
      {
        name: "description",
        content: "سجّل الدخول إلى Kids Shorts AI لإنشاء قصص أطفال قصيرة بالعربية تلقائياً.",
      },
      { property: "og:title", content: "تسجيل الدخول | Kids Shorts AI" },
      {
        property: "og:description",
        content: "سجّل الدخول إلى Kids Shorts AI لإنشاء قصص أطفال قصيرة بالعربية تلقائياً.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب! يمكنك الدخول الآن.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        void navigate({ to: "/" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-sky-pattern px-4">
      <Card className="w-full max-w-md rounded-3xl border-border/70 shadow-lg">
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-14 items-center justify-center rounded-3xl bg-primary text-primary-foreground">
            <Clapperboard className="size-7" />
          </span>
          <CardTitle className="font-display text-2xl">Kids Shorts AI</CardTitle>
          <CardDescription>
            {mode === "signin" ? "أهلاً بعودتك! سجّل الدخول للمتابعة." : "أنشئ حساباً جديداً للبدء."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full rounded-2xl" size="lg" disabled={busy}>
              {busy ? "لحظة…" : mode === "signin" ? "دخول" : "إنشاء حساب"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "ليس لديك حساب؟ أنشئ حساباً" : "لديك حساب؟ سجّل الدخول"}
          </button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/">العودة إلى الصفحة الرئيسية</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
