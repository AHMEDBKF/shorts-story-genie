/**
 * Real AI providers backed by the Lovable AI Gateway.
 * Keys never leave the server: the gateway key is read from the environment
 * inside each call, and the pipeline only ever sees the provider interface.
 */
import type {
  CharacterRef,
  ImageProvider,
  SceneDraft,
  StoryDraft,
  TextProvider,
  VideoMetaDraft,
  VoiceProvider,
} from "./types";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TEXT_MODEL = "google/gemini-3.7-flash";
const IMAGE_MODEL = "google/gemini-3.1-flash-image";
const VOICE_MODEL = "openai/gpt-4o-mini-tts";

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("مفتاح Lovable AI غير متوفّر على الخادم");
  return key;
}

async function gatewayFetch(path: string, body: unknown): Promise<Response> {
  const response = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey(),
    },
    body: JSON.stringify(body),
  });

  if (response.ok) return response;

  const text = await response.text();
  if (response.status === 402) {
    throw new Error("نفد رصيد Lovable AI — أضف رصيداً لمتابعة الإنتاج بالذكاء الاصطناعي الحقيقي.");
  }
  if (response.status === 403) {
    throw new Error("خدمة Lovable AI موقوفة لهذا المشروع أو تجاوزت الحد المسموح.");
  }
  if (response.status === 429) {
    throw new Error("تم تجاوز حد الطلبات مؤقتاً — سيُعاد المحاولة لاحقاً.");
  }
  throw new Error(`فشل طلب Lovable AI (${response.status}): ${text.slice(0, 200)}`);
}

function parseJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const slice = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(slice) as T;
}

async function chatJson<T>(system: string, user: string): Promise<T> {
  const response = await gatewayFetch("/chat/completions", {
    model: TEXT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("لم يُرجع نموذج النص أي محتوى");
  return parseJson<T>(content);
}

function castSheet(characters: CharacterRef[]) {
  if (characters.length === 0) return "لا توجد شخصيات محفوظة، استخدم سميرًا وليلى.";
  return characters
    .map((character) =>
      [
        `الاسم: ${character.name}`,
        character.description && `الوصف: ${character.description}`,
        character.personality && `الطباع: ${character.personality}`,
        character.appearance && `الشكل: ${character.appearance}`,
        character.clothes && `الملابس: ${character.clothes}`,
        character.visual_style && `الأسلوب البصري: ${character.visual_style}`,
      ]
        .filter(Boolean)
        .join("، "),
    )
    .join("\n");
}

export const lovableText: TextProvider = {
  key: "lovable-text",
  label: "نصوص Lovable AI",
  costTier: "low",
  async writeStory({ topic, language, prompt, characters, targetSeconds }) {
    const target = Math.max(10, Math.min(60, Math.round(targetSeconds ?? 45)));
    const short = target < 25;
    const story = await chatJson<StoryDraft>(
      "أنت كاتب قصص أطفال محترف. تكتب قصصاً أصلية قصيرة وآمنة تماماً للأطفال، بلغة بسيطة وواضحة. أعد الإجابة بصيغة JSON فقط.",
      [
        `اكتب قصة قصيرة للأطفال باللغة ${language === "ar" ? "العربية الفصحى المبسّطة" : language} عن: ${topic}.`,
        prompt ? `طلب إضافي من المستخدم: ${prompt}` : "",
        short
          ? `مدة القراءة المستهدفة حوالي ${target} ثانية فقط (من 30 إلى 45 كلمة).`
          : "مدة القراءة المستهدفة بين 30 و60 ثانية (حوالي 90 إلى 150 كلمة).",
        "استخدم هذه الشخصيات الثابتة بأسمائها كما هي:",
        castSheet(characters),
        'أعد JSON بالمفاتيح: {"title","hook","body","lesson","ending","estimatedSeconds"}.',
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return {
      title: story.title,
      hook: story.hook ?? "",
      body: story.body,
      lesson: story.lesson ?? "",
      ending: story.ending ?? "",
      estimatedSeconds: short
        ? target
        : Math.min(60, Math.max(30, Number(story.estimatedSeconds) || 45)),
    };
  },
  async splitScenes({ story, topic, language, characters, sceneCount, targetSeconds }) {
    const count = Math.max(0, Math.min(8, Math.round(sceneCount ?? 0)));
    const total = Math.max(10, Math.min(60, Math.round(targetSeconds ?? story.estimatedSeconds ?? 45)));
    const data = await chatJson<{ scenes: SceneDraft[] }>(
      "أنت مخرج فيديوهات قصيرة للأطفال. تقسم القصص إلى مشاهد عمودية 9:16. أعد الإجابة بصيغة JSON فقط.",
      [
        `قسّم هذه القصة إلى ${count || "5 أو 6"} مشاهد باللغة ${language === "ar" ? "العربية" : language}:`,
        `العنوان: ${story.title}`,
        `الموضوع: ${topic}`,
        `النص: ${story.body}`,
        `النهاية: ${story.ending}`,
        "الشخصيات الثابتة (يجب أن تظهر بنفس الشكل والملابس في كل مشهد):",
        castSheet(characters),
        'أعد JSON بالشكل: {"scenes":[{"sceneNumber","description","characters":["اسم"],"dialogue","narration","imagePrompt","animation","soundEffects","durationSeconds"}]}.',
        `اجعل مجموع durationSeconds قريباً من ${total} ثانية. واجعل imagePrompt وصفاً بصرياً مفصلاً بالإنجليزية يذكر أوصاف الشخصيات وملابسها وإطار 9:16.`,
      ].join("\n"),
    );
    let scenes = Array.isArray(data.scenes) ? data.scenes : [];
    if (scenes.length === 0) throw new Error("لم يُرجع النموذج أي مشاهد");
    if (count && scenes.length > count) scenes = scenes.slice(0, count);
    return scenes.map((scene, index) => ({
      sceneNumber: index + 1,
      description: scene.description ?? "",
      characters: Array.isArray(scene.characters) ? scene.characters : [],
      dialogue: scene.dialogue ?? "",
      narration: scene.narration ?? "",
      imagePrompt: scene.imagePrompt ?? scene.description ?? "",
      animation: scene.animation ?? "تقريب بطيء",
      soundEffects: scene.soundEffects ?? "",
      durationSeconds: Math.min(15, Math.max(3, Number(scene.durationSeconds) || 8)),
    }));
  },
  async writeMetadata({ story, topic, language }) {
    const meta = await chatJson<VideoMetaDraft>(
      "أنت خبير تحسين محتوى يوتيوب شورتس للأطفال. أعد الإجابة بصيغة JSON فقط.",
      [
        `اكتب عنواناً ووصفاً ووسوماً باللغة ${language === "ar" ? "العربية" : language} لفيديو قصير عن ${topic}.`,
        `عنوان القصة: ${story.title}`,
        `الملخص: ${story.hook} ${story.lesson}`,
        'أعد JSON: {"title","description","tags":["..."]}. أضف #shorts في الوصف.',
      ].join("\n"),
    );
    return {
      title: meta.title,
      description: meta.description,
      tags: Array.isArray(meta.tags) ? meta.tags.slice(0, 15) : [],
    };
  },
};

export const lovableImage: ImageProvider = {
  key: "lovable-image",
  label: "صور Lovable AI",
  costTier: "low",
  async renderScene({ prompt, sceneNumber, totalScenes, title }) {
    const response = await gatewayFetch("/chat/completions", {
      model: IMAGE_MODEL,
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            `Children's cartoon illustration, vertical 9:16 aspect ratio (1080x1920), soft warm lighting, safe for kids, no text overlay.`,
            `Story: ${title}. Scene ${sceneNumber} of ${totalScenes}.`,
            prompt,
          ].join("\n"),
        },
      ],
    });
    const data = (await response.json()) as {
      choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
    };
    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url?.startsWith("data:")) throw new Error("لم يُرجع النموذج صورة");
    const [header, base64] = url.split(",");
    const contentType = header?.slice(5).split(";")[0] ?? "image/png";
    const binary = atob(base64 ?? "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return {
      bytes,
      contentType,
      extension: contentType.includes("jpeg") ? "jpg" : "png",
    };
  },
};

export const lovableVoice: VoiceProvider = {
  key: "lovable-voice",
  label: "صوت Lovable AI",
  costTier: "low",
  async speak({ text, durationSeconds }) {
    const response = await gatewayFetch("/audio/speech", {
      model: VOICE_MODEL,
      input: text,
      voice: "alloy",
      response_format: "mp3",
      instructions:
        "Speak in clear, warm, friendly Modern Standard Arabic, at a gentle pace suitable for young children.",
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 512) throw new Error("ملف الصوت الناتج غير صالح");
    return {
      bytes,
      contentType: "audio/mpeg",
      extension: "mp3",
      durationSeconds: Math.max(2, durationSeconds || text.length / 14),
    };
  },
};
