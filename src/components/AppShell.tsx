import { Link, useRouterState } from "@tanstack/react-router";
import { Clapperboard, Film, Settings, Sparkles, Users } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "لوحة التحكم", icon: Sparkles },
  { to: "/characters", label: "الشخصيات", icon: Users },
  { to: "/videos", label: "الفيديوهات", icon: Film },
  { to: "/settings", label: "الإعدادات", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="min-h-screen bg-background bg-sky-pattern">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Clapperboard className="size-5" />
            </span>
            <span className="font-display text-xl font-bold leading-none">
              Kids Shorts AI
              <span className="block text-xs font-normal text-muted-foreground">
                مصنع قصص الأطفال التلقائي
              </span>
            </span>
          </Link>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-2 sm:w-auto sm:flex-1 sm:justify-center">
            {NAV.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Button
            variant="ghost"
            size="sm"
            className="order-2 ms-auto sm:order-3 sm:ms-0"
            onClick={() => void supabase.auth.signOut()}
          >
            خروج
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-16">{children}</main>
    </div>
  );
}
