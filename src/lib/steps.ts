export const STEP_ORDER = [
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

export type StepName = (typeof STEP_ORDER)[number];

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
