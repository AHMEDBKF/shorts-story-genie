import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Account = {
  id: string;
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
};

/** Returns a valid access token, refreshing it through Google when expired. */
async function getAccessToken(account: Account): Promise<string> {
  const stillValid =
    account.access_token &&
    account.token_expires_at &&
    new Date(account.token_expires_at).getTime() - 60_000 > Date.now();
  if (stillValid) return account.access_token as string;

  const clientId = process.env["YOUTUBE_CLIENT_ID"];
  const clientSecret = process.env["YOUTUBE_CLIENT_SECRET"];
  if (!clientId || !clientSecret) throw new Error("لم يتم إعداد بيانات يوتيوب بعد.");
  if (!account.refresh_token) throw new Error("انتهت صلاحية ربط قناة يوتيوب. أعد الربط.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "تعذّر تجديد صلاحية يوتيوب.");
  }

  const expiresAt = new Date(Date.now() + (payload.expires_in ?? 3500) * 1000).toISOString();
  await supabaseAdmin
    .from("youtube_accounts")
    .update({ access_token: payload.access_token, token_expires_at: expiresAt })
    .eq("id", account.id);
  return payload.access_token;
}

export type UploadOutcome = {
  status: "uploaded" | "awaiting_video" | "not_connected" | "failed";
  detail: string;
  youtubeVideoId?: string;
};

/**
 * Uploads a finished render to the user's own channel as a private video.
 * Nothing is ever published publicly by the system.
 */
export async function uploadRenderToYoutube(
  jobId: string,
  userId: string,
): Promise<UploadOutcome> {
  const { data: video } = await supabaseAdmin
    .from("videos")
    .select("id, title, description, tags, storage_path, render_status")
    .eq("job_id", jobId)
    .maybeSingle();

  const record = async (fields: Record<string, unknown>) => {
    await supabaseAdmin.from("youtube_uploads").upsert(
      {
        user_id: userId,
        job_id: jobId,
        video_id: video?.id ?? null,
        privacy_status: "private",
        title: video?.title ?? null,
        description: video?.description ?? null,
        ...fields,
      },
      { onConflict: "job_id" },
    );
  };

  if (!video?.storage_path) {
    await record({ status: "awaiting_video" });
    return { status: "awaiting_video", detail: "الرفع ينتظر ملف الفيديو النهائي." };
  }

  const { data: account } = await supabaseAdmin
    .from("youtube_accounts")
    .select("id, user_id, access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!account) {
    await record({ status: "not_connected" });
    return { status: "not_connected", detail: "لم يتم ربط قناة يوتيوب بعد." };
  }

  try {
    const token = await getAccessToken(account as Account);
    const { data: file, error } = await supabaseAdmin.storage
      .from("media")
      .download(video.storage_path);
    if (error || !file) throw new Error(error?.message ?? "تعذّر قراءة ملف الفيديو.");
    const bytes = new Uint8Array(await file.arrayBuffer());

    const start = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "X-Upload-Content-Length": String(bytes.byteLength),
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify({
          snippet: {
            title: (video.title ?? "قصة أطفال").slice(0, 100),
            description: video.description ?? "",
            tags: video.tags ?? [],
            categoryId: "27",
            defaultLanguage: "ar",
          },
          status: { privacyStatus: "private", selfDeclaredMadeForKids: true },
        }),
      },
    );
    const location = start.headers.get("location");
    if (!start.ok || !location) {
      throw new Error(`تعذّر بدء الرفع (${start.status}): ${await start.text()}`);
    }

    const upload = await fetch(location, {
      method: "PUT",
      headers: { "content-type": "video/mp4", "content-length": String(bytes.byteLength) },
      body: bytes,
    });
    const result = (await upload.json()) as { id?: string; error?: { message?: string } };
    if (!upload.ok || !result.id) {
      throw new Error(result.error?.message ?? `فشل الرفع (${upload.status}).`);
    }

    await record({
      status: "uploaded",
      youtube_video_id: result.id,
      published_at: new Date().toISOString(),
      error: null,
    });
    await supabaseAdmin
      .from("videos")
      .update({ public_url: `https://youtu.be/${result.id}` })
      .eq("job_id", jobId);

    return {
      status: "uploaded",
      detail: `تم الرفع كفيديو خاص (${result.id}).`,
      youtubeVideoId: result.id,
    };
  } catch (uploadError) {
    const message = uploadError instanceof Error ? uploadError.message : String(uploadError);
    await record({ status: "failed", error: message });
    return { status: "failed", detail: message };
  }
}
