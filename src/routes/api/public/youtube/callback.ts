import { createFileRoute } from "@tanstack/react-router";

function back(origin: string, status: string) {
  return new Response(null, {
    status: 302,
    headers: { location: `${origin}/settings?youtube=${status}` },
  });
}

export const Route = createFileRoute("/api/public/youtube/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return back(origin, "error");

        const clientId = process.env["YOUTUBE_CLIENT_ID"];
        const clientSecret = process.env["YOUTUBE_CLIENT_SECRET"];
        if (!clientId || !clientSecret) return back(origin, "not-configured");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: lock } = await supabaseAdmin
          .from("job_locks")
          .select("holder, locked_until")
          .eq("key", `yt-state:${state}`)
          .maybeSingle();
        if (!lock?.holder || new Date(lock.locked_until) < new Date()) {
          return back(origin, "expired");
        }
        await supabaseAdmin.from("job_locks").delete().eq("key", `yt-state:${state}`);

        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: `${origin}/api/public/youtube/callback`,
            grant_type: "authorization_code",
          }),
        });
        if (!tokenResponse.ok) {
          console.error("youtube token exchange failed", await tokenResponse.text());
          return back(origin, "error");
        }
        const token = (await tokenResponse.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope: string;
        };

        let channelId: string | null = null;
        let channelTitle: string | null = null;
        const channelResponse = await fetch(
          "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
          { headers: { authorization: `Bearer ${token.access_token}` } },
        );
        if (channelResponse.ok) {
          const payload = (await channelResponse.json()) as {
            items?: { id: string; snippet: { title: string } }[];
          };
          channelId = payload.items?.[0]?.id ?? null;
          channelTitle = payload.items?.[0]?.snippet.title ?? null;
        }

        await supabaseAdmin.from("youtube_accounts").upsert(
          {
            user_id: lock.holder,
            channel_id: channelId,
            channel_title: channelTitle,
            access_token: token.access_token,
            refresh_token: token.refresh_token ?? null,
            token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
            scope: token.scope,
          },
          { onConflict: "user_id" },
        );

        return back(origin, "connected");
      },
    },
  },
});
