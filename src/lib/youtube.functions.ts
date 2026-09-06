import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

export const getYoutubeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const configured = Boolean(
      process.env["YOUTUBE_CLIENT_ID"] && process.env["YOUTUBE_CLIENT_SECRET"],
    );
    const { data } = await supabaseAdmin
      .from("youtube_accounts")
      .select("channel_title, channel_id, connected_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      configured,
      connected: Boolean(data),
      channelTitle: data?.channel_title ?? null,
      connectedAt: data?.connected_at ?? null,
    };
  });

export const getYoutubeAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = process.env["YOUTUBE_CLIENT_ID"];
    if (!clientId) throw new Error("لم يتم إعداد بيانات يوتيوب بعد.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const request = getRequest();
    const origin = new URL(request.url).origin;
    const state = crypto.randomUUID();

    await supabaseAdmin.from("job_locks").upsert({
      key: `yt-state:${state}`,
      holder: context.userId,
      locked_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", `${origin}/api/public/youtube/callback`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return { url: url.toString() };
  });

export const disconnectYoutube = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("youtube_accounts").delete().eq("user_id", context.userId);
    return { ok: true };
  });
