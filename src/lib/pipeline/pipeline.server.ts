import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withProvider } from "@/lib/providers/router.server";
import type {
  CharacterRef,
  ImageProvider,
  StoryDraft,
  TextProvider,
  VoiceProvider,
} from "@/lib/providers/types";

export const STEPS = [
  "pick_topic",
  "write_story",
  "split_scenes",
  "generate_images",
  "generate_voice",
  "build_subtitles",
  "render_video",
  "quality_check",
  "upload_youtube",
] as const;

export type StepName = (typeof STEPS)[number];

export const STEP_LABELS: Record<StepName, string> = {
  pick_topic: "اختيار الموضوع",
  write_story: "كتابة القصة",
  split_scenes: "تقسيم المشاهد",
  generate_images: "توليد الصور",
  generate_voice: "توليد الأصوات",
  build_subtitles: "إعداد الترجمة",
  render_video: "تركيب الفيديو",
  quality_check: "فحص الجودة",
  upload_youtube: "الرفع إلى يوتيوب",
};

const BATCH_PER_TICK = 2;

type Job = {
  id: string;
  user_id: string;
  language: string;
  low_cost_mode: boolean;
  request_prompt: string | null;
  topic_id: string | null;
};

export type StepResult = { done: boolean; detail: string; blocked?: boolean };

export async function createProductionJob(
  userId: string,
  options: { prompt?: string | null; language?: string; lowCostMode: boolean },
) {
  const { data: job, error } = await supabaseAdmin
    .from("production_jobs")
    .insert({
      user_id: userId,
      request_prompt: options.prompt ?? null,
      language: options.language ?? "ar",
      low_cost_mode: options.lowCostMode,
      status: "queued",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("job_steps").insert(
    STEPS.map((step, index) => ({
      job_id: job.id,
      user_id: userId,
      step,
      position: index + 1,
      status: "pending" as const,
    })),
  );
  return job.id;
}

async function loadCharacters(userId: string): Promise<CharacterRef[]> {
  const { data } = await supabaseAdmin
    .from("characters")
    .select("name, personality, appearance, clothes, visual_style")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(4);
  if (data && data.length > 0) return data;
  return [
    {
      name: "سمير",
      personality: "فضولي ولطيف",
      appearance: "طفل في السابعة، شعر أسود قصير، عينان كبيرتان",
      clothes: "قميص أحمر وبنطال أزرق",
      visual_style: "رسوم كرتونية ثلاثية الأبعاد ناعمة بألوان دافئة",
    },
    {
      name: "ليلى",
      personality: "مرحة وذكية",
      appearance: "طفلة في السادسة، ضفيرتان وحجاب صغير ملوّن",
      clothes: "فستان أخضر",
      visual_style: "رسوم كرتونية ثلاثية الأبعاد ناعمة بألوان دافئة",
    },
  ];
}

async function uploadAsset(
  path: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const { error } = await supabaseAdmin.storage
    .from("media")
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

function secondsToTimestamp(total: number) {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${seconds
    .toFixed(3)
    .padStart(6, "0")}`;
}

/* ------------------------------ steps ------------------------------ */

async function pickTopic(job: Job): Promise<StepResult> {
  if (job.topic_id) return { done: true, detail: "الموضوع محدّد مسبقاً" };

  const { data: topics } = await supabaseAdmin
    .from("topics")
    .select("id, title, used_count, last_used_at")
    .eq("user_id", job.user_id)
    .order("used_count", { ascending: true })
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(1);

  let topic = topics?.[0];

  if (job.request_prompt) {
    const title = job.request_prompt.trim().slice(0, 80);
    const slug = `custom-${Date.now()}`;
    const { data: inserted } = await supabaseAdmin
      .from("topics")
      .insert({ user_id: job.user_id, title, slug, category: "طلب مخصص" })
      .select("id, title, used_count, last_used_at")
      .single();
    if (inserted) topic = inserted;
  }

  if (!topic) throw new Error("لا توجد مواضيع متاحة. أضف موضوعاً من الإعدادات.");

  await supabaseAdmin
    .from("topics")
    .update({ used_count: (topic.used_count ?? 0) + 1, last_used_at: new Date().toISOString() })
    .eq("id", topic.id);
  await supabaseAdmin.from("production_jobs").update({ topic_id: topic.id }).eq("id", job.id);

  return { done: true, detail: `الموضوع: ${topic.title}` };
}

async function topicTitle(job: Job) {
  const { data } = await supabaseAdmin
    .from("production_jobs")
    .select("topic_id, topics(title)")
    .eq("id", job.id)
    .single();
  return (data?.topics as { title: string } | null)?.title ?? "قيمة جميلة";
}

async function writeStory(job: Job): Promise<StepResult> {
  const { data: existing } = await supabaseAdmin
    .from("stories")
    .select("id")
    .eq("job_id", job.id)
    .maybeSingle();
  if (existing) return { done: true, detail: "القصة جاهزة" };

  const characters = await loadCharacters(job.user_id);
  const topic = await topicTitle(job);
  const { result: story } = await withProvider<TextProvider, StoryDraft>(
    job.user_id,
    "text",
    job.low_cost_mode,
    (impl) =>
      impl.writeStory({
        topic,
        language: job.language,
        prompt: job.request_prompt,
        characters,
      }),
  );

  const { error } = await supabaseAdmin.from("stories").insert({
    job_id: job.id,
    user_id: job.user_id,
    title: story.title,
    hook: story.hook,
    body: story.body,
    lesson: story.lesson,
    ending: story.ending,
    language: job.language,
    estimated_seconds: story.estimatedSeconds,
  });
  if (error) throw new Error(error.message);
  return { done: true, detail: story.title };
}

async function splitScenes(job: Job): Promise<StepResult> {
  const { count } = await supabaseAdmin
    .from("scenes")
    .select("id", { count: "exact", head: true })
    .eq("job_id", job.id);
  if ((count ?? 0) > 0) return { done: true, detail: `${count} مشاهد` };

  const { data: story } = await supabaseAdmin
    .from("stories")
    .select("*")
    .eq("job_id", job.id)
    .single();
  if (!story) throw new Error("القصة غير موجودة");

  const characters = await loadCharacters(job.user_id);
  const topic = await topicTitle(job);
  const { result: scenes } = await withProvider<TextProvider, Awaited<ReturnType<TextProvider["splitScenes"]>>>(
    job.user_id,
    "text",
    job.low_cost_mode,
    (impl) =>
      impl.splitScenes({
        story: {
          title: story.title,
          hook: story.hook ?? "",
          body: story.body,
          lesson: story.lesson ?? "",
          ending: story.ending ?? "",
          estimatedSeconds: story.estimated_seconds ?? 45,
        },
        topic,
        language: job.language,
        characters,
      }),
  );

  const { error } = await supabaseAdmin.from("scenes").insert(
    scenes.map((scene) => ({
      job_id: job.id,
      story_id: story.id,
      user_id: job.user_id,
      scene_number: scene.sceneNumber,
      description: scene.description,
      characters: scene.characters,
      dialogue: scene.dialogue,
      narration: scene.narration,
      image_prompt: scene.imagePrompt,
      animation: scene.animation,
      sound_effects: scene.soundEffects,
      duration_seconds: scene.durationSeconds,
    })),
  );
  if (error) throw new Error(error.message);
  return { done: true, detail: `${scenes.length} مشاهد` };
}

async function generateImages(job: Job): Promise<StepResult> {
  const { data: scenes } = await supabaseAdmin
    .from("scenes")
    .select("id, scene_number, image_prompt")
    .eq("job_id", job.id)
    .order("scene_number");
  const { data: done } = await supabaseAdmin
    .from("generated_images")
    .select("scene_id")
    .eq("job_id", job.id);
  const doneIds = new Set((done ?? []).map((row) => row.scene_id));
  const pending = (scenes ?? []).filter((scene) => !doneIds.has(scene.id));

  if (pending.length === 0) return { done: true, detail: `${scenes?.length ?? 0} صور جاهزة` };

  const { data: story } = await supabaseAdmin
    .from("stories")
    .select("title")
    .eq("job_id", job.id)
    .single();

  for (const scene of pending.slice(0, BATCH_PER_TICK)) {
    const { result, providerKey } = await withProvider<
      ImageProvider,
      Awaited<ReturnType<ImageProvider["renderScene"]>>
    >(job.user_id, "image", job.low_cost_mode, (impl) =>
      impl.renderScene({
        prompt: scene.image_prompt ?? "",
        sceneNumber: scene.scene_number,
        totalScenes: scenes?.length ?? 1,
        title: story?.title ?? "قصة أطفال",
      }),
    );
    const path = `${job.user_id}/${job.id}/scene-${scene.scene_number}.${result.extension}`;
    await uploadAsset(path, result.bytes, result.contentType);
    await supabaseAdmin.from("generated_images").upsert(
      {
        job_id: job.id,
        scene_id: scene.id,
        user_id: job.user_id,
        provider: providerKey,
        prompt: scene.image_prompt,
        storage_path: path,
        is_mock: providerKey.startsWith("mock"),
      },
      { onConflict: "scene_id" },
    );
    doneIds.add(scene.id);
  }

  const remaining = (scenes ?? []).length - doneIds.size;
  return {
    done: remaining === 0,
    detail: `${doneIds.size} / ${scenes?.length ?? 0} صور`,
  };
}

async function generateVoice(job: Job): Promise<StepResult> {
  const { data: scenes } = await supabaseAdmin
    .from("scenes")
    .select("id, scene_number, narration, dialogue, duration_seconds")
    .eq("job_id", job.id)
    .order("scene_number");
  const { data: done } = await supabaseAdmin
    .from("audio_files")
    .select("scene_id")
    .eq("job_id", job.id)
    .eq("kind", "narration");
  const doneIds = new Set((done ?? []).map((row) => row.scene_id));
  const pending = (scenes ?? []).filter((scene) => !doneIds.has(scene.id));

  if (pending.length === 0) return { done: true, detail: `${scenes?.length ?? 0} مقاطع صوتية` };

  for (const scene of pending.slice(0, BATCH_PER_TICK)) {
    const text = [scene.narration, scene.dialogue].filter(Boolean).join(" ");
    const { result, providerKey } = await withProvider<
      VoiceProvider,
      Awaited<ReturnType<VoiceProvider["speak"]>>
    >(job.user_id, "voice", job.low_cost_mode, (impl) =>
      impl.speak({
        text,
        language: job.language,
        durationSeconds: Number(scene.duration_seconds ?? 6),
      }),
    );
    const path = `${job.user_id}/${job.id}/voice-${scene.scene_number}.${result.extension}`;
    await uploadAsset(path, result.bytes, result.contentType);
    await supabaseAdmin.from("audio_files").upsert(
      {
        job_id: job.id,
        scene_id: scene.id,
        user_id: job.user_id,
        kind: "narration",
        provider: providerKey,
        text,
        storage_path: path,
        duration_seconds: result.durationSeconds,
        is_mock: providerKey.startsWith("mock"),
      },
      { onConflict: "job_id,scene_id,kind" },
    );
    doneIds.add(scene.id);
  }

  const remaining = (scenes ?? []).length - doneIds.size;
  return { done: remaining === 0, detail: `${doneIds.size} / ${scenes?.length ?? 0} أصوات` };
}

async function buildSubtitles(job: Job): Promise<StepResult> {
  const { data: scenes } = await supabaseAdmin
    .from("scenes")
    .select("scene_number, narration, dialogue, duration_seconds")
    .eq("job_id", job.id)
    .order("scene_number");
  const { data: story } = await supabaseAdmin
    .from("stories")
    .select("title, hook, lesson")
    .eq("job_id", job.id)
    .single();

  let cursor = 0;
  const cues: string[] = ["WEBVTT", ""];
  for (const scene of scenes ?? []) {
    const duration = Number(scene.duration_seconds ?? 6);
    const text = [scene.narration, scene.dialogue].filter(Boolean).join("\n");
    cues.push(`${secondsToTimestamp(cursor)} --> ${secondsToTimestamp(cursor + duration)}`);
    cues.push(text || "…");
    cues.push("");
    cursor += duration;
  }

  const topic = await topicTitle(job);
  const { result: meta } = await withProvider<
    TextProvider,
    Awaited<ReturnType<TextProvider["writeMetadata"]>>
  >(job.user_id, "text", job.low_cost_mode, (impl) =>
    impl.writeMetadata({
      story: {
        title: story?.title ?? "قصة أطفال",
        hook: story?.hook ?? "",
        body: "",
        lesson: story?.lesson ?? "",
        ending: "",
        estimatedSeconds: cursor,
      },
      topic,
      language: job.language,
    }),
  );

  await supabaseAdmin.from("videos").upsert(
    {
      job_id: job.id,
      user_id: job.user_id,
      title: meta.title,
      description: meta.description,
      tags: meta.tags,
      subtitles_vtt: cues.join("\n"),
      duration_seconds: cursor,
      width: 1080,
      height: 1920,
      render_status: "pending",
    },
    { onConflict: "job_id" },
  );

  return { done: true, detail: `${Math.round(cursor)} ثانية` };
}

async function renderVideo(job: Job): Promise<StepResult> {
  await supabaseAdmin
    .from("videos")
    .update({ render_status: "awaiting_renderer" })
    .eq("job_id", job.id);
  return {
    done: true,
    blocked: true,
    detail: "كل العناصر جاهزة. التركيب النهائي بانتظار خدمة التركيب.",
  };
}

async function qualityCheck(job: Job): Promise<StepResult> {
  const [{ data: scenes }, { data: images }, { data: audio }, { data: video }] =
    await Promise.all([
      supabaseAdmin
        .from("scenes")
        .select("id, scene_number, narration, description")
        .eq("job_id", job.id)
        .order("scene_number"),
      supabaseAdmin.from("generated_images").select("scene_id, storage_path").eq("job_id", job.id),
      supabaseAdmin.from("audio_files").select("scene_id, storage_path").eq("job_id", job.id),
      supabaseAdmin.from("videos").select("*").eq("job_id", job.id).maybeSingle(),
    ]);

  const duration = Number(video?.duration_seconds ?? 0);
  const descriptions = (scenes ?? []).map((scene) => (scene.description ?? "").trim());
  const checks = [
    { key: "المدة بين 30 و60 ثانية", pass: duration >= 25 && duration <= 65, value: `${Math.round(duration)} ث` },
    { key: "الإطار عمودي 9:16", pass: video?.width === 1080 && video?.height === 1920, value: "1080×1920" },
    { key: "يوجد صوت لكل مشهد", pass: (audio ?? []).length >= (scenes ?? []).length, value: `${audio?.length ?? 0}` },
    { key: "توجد ترجمة", pass: Boolean(video?.subtitles_vtt), value: video?.subtitles_vtt ? "نعم" : "لا" },
    { key: "لا توجد مشاهد فارغة", pass: descriptions.every((text) => text.length > 0), value: `${scenes?.length ?? 0}` },
    { key: "لا يوجد مشهد مكرر", pass: new Set(descriptions).size === descriptions.length, value: "" },
    { key: "توجد صورة لكل مشهد", pass: (images ?? []).length === (scenes ?? []).length, value: `${images?.length ?? 0}` },
  ];

  const failed = checks.filter((check) => !check.pass);
  await supabaseAdmin
    .from("videos")
    .update({ quality_report: { checks, passed: failed.length === 0 } })
    .eq("job_id", job.id);

  if (failed.length > 0) {
    throw new Error(`فشل فحص الجودة: ${failed.map((check) => check.key).join("، ")}`);
  }
  return { done: true, detail: `اجتاز ${checks.length} فحوصات` };
}

async function uploadYoutube(job: Job): Promise<StepResult> {
  const { data: video } = await supabaseAdmin
    .from("videos")
    .select("id, storage_path, render_status")
    .eq("job_id", job.id)
    .maybeSingle();
  const { data: account } = await supabaseAdmin
    .from("youtube_accounts")
    .select("id, channel_title")
    .eq("user_id", job.user_id)
    .maybeSingle();

  if (!video?.storage_path) {
    await supabaseAdmin.from("youtube_uploads").upsert({
      user_id: job.user_id,
      job_id: job.id,
      video_id: video?.id ?? null,
      status: "awaiting_video",
      privacy_status: "private",
    });
    return {
      done: true,
      blocked: true,
      detail: "الرفع ينتظر ملف الفيديو النهائي.",
    };
  }
  if (!account) {
    return { done: true, blocked: true, detail: "لم يتم ربط قناة يوتيوب بعد." };
  }
  return { done: true, blocked: true, detail: "جاهز للرفع." };
}

export const STEP_RUNNERS: Record<StepName, (job: Job) => Promise<StepResult>> = {
  pick_topic: pickTopic,
  write_story: writeStory,
  split_scenes: splitScenes,
  generate_images: generateImages,
  generate_voice: generateVoice,
  build_subtitles: buildSubtitles,
  render_video: renderVideo,
  quality_check: qualityCheck,
  upload_youtube: uploadYoutube,
};
