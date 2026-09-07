// Placeholder ("mock") providers. They produce real, stored files and real
// text so the whole pipeline can be exercised before paid keys are configured.
import type {
  ImageProvider,
  MusicProvider,
  SceneDraft,
  StoryDraft,
  TextProvider,
  VoiceProvider,
} from "./types";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PALETTES = [
  ["#FFD79B", "#FF9F68"],
  ["#B8E6D2", "#5FC9A6"],
  ["#CFE0FF", "#7BA7F5"],
  ["#FFD3E2", "#F58BB0"],
  ["#F1E0FF", "#B58BF5"],
  ["#FFF0B8", "#F5C95F"],
];

export const mockText: TextProvider = {
  key: "mock-text",
  label: "مولّد نصوص تجريبي",
  costTier: "free",
  async writeStory({ topic, prompt, characters }) {
    const hero = characters[0]?.name ?? "سمير";
    const friend = characters[1]?.name ?? "ليلى";
    const hook = `هل تعرف ماذا حدث لـ${hero} عندما تعلّم درساً عن ${topic}؟`;
    const body = [
      `${hook}`,
      `في صباح مشمس، خرج ${hero} إلى الحديقة ومعه صديقته ${friend}.`,
      `واجه ${hero} موقفاً صعباً يتعلق بـ${topic}، وتردّد في البداية.`,
      `ساعدته ${friend} على اختيار الطريق الصحيح بابتسامة لطيفة.`,
      `عندما فعل ${hero} الصواب، شعر بسعادة كبيرة وفرح الجميع من حوله.`,
      `وهكذا تعلّم ${hero} أن ${topic} يجعل القلب سعيداً والأصدقاء أقرب.`,
    ].join(" ");
    return {
      title: `${topic} مع ${hero}`,
      hook,
      body: prompt ? `${body} (${prompt})` : body,
      lesson: `${topic} صفة جميلة تجعلنا محبوبين عند الله وعند الناس.`,
      ending: `ولا تنسَ: ${topic} يبدأ من قلبك الصغير!`,
      estimatedSeconds: 45,
    } satisfies StoryDraft;
  },
  async splitScenes({ story, topic, characters }) {
    const hero = characters[0]?.name ?? "سمير";
    const friend = characters[1]?.name ?? "ليلى";
    const style =
      characters[0]?.visual_style ??
      "رسوم كرتونية ثلاثية الأبعاد ناعمة، ألوان دافئة، مناسبة للأطفال";
    const sheet = characters.length
      ? characters
          .map((character) =>
            [
              character.name,
              character.appearance,
              character.clothes,
              character.description,
            ]
              .filter(Boolean)
              .join(" — "),
          )
          .join(" | ")
      : `${hero}: طفل بقميص أحمر | ${friend}: طفلة بفستان أخضر`;
    const beats = [
      {
        description: `لقطة افتتاحية: ${hero} يقف في حديقة مشرقة والكاميرا تقترب منه.`,
        dialogue: `${hero}: يا لهذا الصباح الجميل!`,
        narration: story.hook,
        animation: "تقريب بطيء (Zoom In) مع اهتزاز خفيف للكاميرا",
        sfx: "زقزقة عصافير ونسمة هواء",
      },
      {
        description: `${hero} يواجه موقفاً يتعلق بـ${topic} ويظهر على وجهه التردد.`,
        dialogue: `${hero}: ماذا أفعل الآن؟`,
        narration: `واجه ${hero} موقفاً صعباً يتعلق بـ${topic}.`,
        animation: "تحريك أفقي (Pan) من اليمين إلى اليسار",
        sfx: "نغمة تشويق قصيرة",
      },
      {
        description: `${friend} تقترب من ${hero} وتبتسم وتنصحه بلطف.`,
        dialogue: `${friend}: اختر الطريق الصحيح يا ${hero}!`,
        narration: `ساعدته ${friend} على اختيار الطريق الصحيح.`,
        animation: "تقريب على الوجهين ثم انتقال ناعم",
        sfx: "رنّة لطيفة"
      },
      {
        description: `${hero} يفعل الصواب والجميع يصفّق له وتتطاير قصاصات ملونة.`,
        dialogue: `${hero}: فعلتها!`,
        narration: `عندما فعل ${hero} الصواب شعر بسعادة كبيرة.`,
        animation: "إبعاد الكاميرا (Zoom Out) مع حركة احتفالية",
        sfx: "تصفيق وموسيقى فرح",
      },
      {
        description: `لقطة ختامية: ${hero} و${friend} يلوّحان والشمس تغرب خلفهما.`,
        dialogue: `${hero} و${friend}: إلى اللقاء!`,
        narration: story.ending,
        animation: "تقريب بطيء جداً مع تلاشٍ للأبيض",
        sfx: "موسيقى ختامية هادئة",
      },
    ];
    return beats.map((beat, index) => ({
      sceneNumber: index + 1,
      description: beat.description,
      characters: index === 0 || index === 1 ? [hero] : [hero, friend],
      dialogue: beat.dialogue,
      narration: beat.narration,
      imagePrompt: `${beat.description} — ${style}، إطار عمودي 9:16، إضاءة ناعمة. أوصاف الشخصيات الثابتة: ${sheet}. حافظ على نفس الوجوه ونفس الملابس في كل المشاهد.`,
      animation: beat.animation,
      soundEffects: beat.sfx,
      durationSeconds: index === 0 ? 6 : 9,
    })) satisfies SceneDraft[];
  },
  async writeMetadata({ story, topic }) {
    return {
      title: `${story.title} | قصة أطفال قصيرة عن ${topic} 🌟`,
      description: [
        story.hook,
        "",
        story.lesson,
        "",
        "قصة قصيرة أصلية للأطفال بالعربية، من إنتاج Kids Shorts AI.",
        "",
        `#${topic.replace(/\s+/g, "_")} #قصص_أطفال #تعليم_الأطفال #shorts`,
      ].join("\n"),
      tags: ["قصص أطفال", "تعليم", topic, "shorts", "كرتون عربي"],
    };
  },
};

export const mockImage: ImageProvider = {
  key: "mock-image",
  label: "مولّد صور تجريبي",
  costTier: "free",
  async renderScene({ prompt, sceneNumber, totalScenes, title }) {
    const palette = PALETTES[(sceneNumber - 1) % PALETTES.length]!;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette[0]}"/>
      <stop offset="100%" stop-color="${palette[1]}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <circle cx="860" cy="300" r="150" fill="#FFF6D8" opacity="0.85"/>
  <ellipse cx="540" cy="1700" rx="700" ry="260" fill="#7CC98A" opacity="0.75"/>
  <circle cx="430" cy="1180" r="150" fill="#FFE0C2"/>
  <circle cx="380" cy="1140" r="18" fill="#3A2E2A"/>
  <circle cx="480" cy="1140" r="18" fill="#3A2E2A"/>
  <path d="M385 1215 Q430 1265 475 1215" stroke="#3A2E2A" stroke-width="12" fill="none" stroke-linecap="round"/>
  <rect x="330" y="1330" width="200" height="240" rx="60" fill="#F16A6A"/>
  <circle cx="680" cy="1230" r="110" fill="#FFE0C2"/>
  <circle cx="645" cy="1200" r="14" fill="#3A2E2A"/>
  <circle cx="715" cy="1200" r="14" fill="#3A2E2A"/>
  <path d="M648 1262 Q680 1296 712 1262" stroke="#3A2E2A" stroke-width="10" fill="none" stroke-linecap="round"/>
  <rect x="605" y="1340" width="150" height="200" rx="50" fill="#5FA8F5"/>
  <text x="540" y="180" text-anchor="middle" font-size="64" font-family="sans-serif" fill="#3A2E2A">${escapeXml(title).slice(0, 26)}</text>
  <text x="540" y="1860" text-anchor="middle" font-size="42" font-family="sans-serif" fill="#3A2E2A" opacity="0.8">مشهد ${sceneNumber} / ${totalScenes} — معاينة تجريبية</text>
  <text x="540" y="1900" text-anchor="middle" font-size="26" font-family="sans-serif" fill="#3A2E2A" opacity="0.6">${escapeXml(prompt).slice(0, 90)}</text>
</svg>`;
    return {
      bytes: new TextEncoder().encode(svg),
      contentType: "image/svg+xml",
      extension: "svg",
    };
  },
};

/** Minimal 8kHz mono 8-bit PCM WAV of the requested length (quiet tone). */
function makeWav(durationSeconds: number, freq: number) {
  const rate = 8000;
  const samples = Math.max(1, Math.round(rate * durationSeconds));
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, "data");
  view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i += 1) {
    const envelope = Math.min(1, i / 400, (samples - i) / 400);
    bytes[44 + i] = 128 + Math.round(18 * envelope * Math.sin((2 * Math.PI * freq * i) / rate));
  }
  return bytes;
}

export const mockVoice: VoiceProvider = {
  key: "mock-voice",
  label: "مولّد صوت تجريبي",
  costTier: "free",
  async speak({ text, durationSeconds }) {
    const seconds = Math.max(2, Math.min(20, durationSeconds || text.length / 14));
    return {
      bytes: makeWav(seconds, 210),
      contentType: "audio/wav",
      extension: "wav",
      durationSeconds: seconds,
    };
  },
};

export const mockMusic: MusicProvider = {
  key: "mock-music",
  label: "موسيقى تجريبية",
  costTier: "free",
  async compose({ durationSeconds }) {
    const seconds = Math.max(5, Math.min(90, durationSeconds));
    return {
      bytes: makeWav(seconds, 330),
      contentType: "audio/wav",
      extension: "wav",
      durationSeconds: seconds,
    };
  },
};
