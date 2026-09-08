# Kids Shorts AI — end-to-end production test checklist

Run this once, in Production Test Mode, before the first real video.
Every step is visible on the production status page; a failed step is shown in red
with its error message and can be retried from the same page.

Enable الإعدادات → الإنتاج → «وضع الاختبار» first. Test runs produce
3 scenes / ~12 seconds and use the low-cost provider settings.

| # | Step | Where to verify | Pass criteria |
| --- | --- | --- | --- |
| 1 | Create a production job | Dashboard → «إنشاء فيديو هذا الأسبوع» | A job appears with 9 steps in "pending". |
| 2 | Topic | Step «اختيار الموضوع» | Completed, shows a topic not used recently. |
| 3 | Story | Step «كتابة القصة» | Completed, Arabic title + body stored. |
| 4 | Scenes | Step «تقسيم المشاهد» | 3 scenes in test mode, each with description, narration, dialogue, image prompt, animation and sound effects. |
| 5 | Images | Step «توليد الصور» | One 1080×1920 image per scene in private storage. |
| 6 | Arabic narration | Step «توليد الأصوات» | One MP3 per scene; total ≈ 10–15 s in test mode. |
| 7 | Subtitles | Step «إعداد الترجمة» | WEBVTT stored on the video row; cues match scene timings. |
| 8 | Send to renderer | Step «تركيب الفيديو» | Renderer returns `202` with a `renderId`; video row becomes `rendering`. |
| 9 | Render MP4 | Renderer `GET /render/{renderId}` or the callback | `completed` with a URL; MP4 is 1080×1920, H.264 + AAC, Ken Burns motion, Arabic subtitles burned in. |
| 10 | Quality checks | Step «فحص الجودة» | All checks pass (duration, 9:16, audio per scene, subtitles, no empty/duplicate scenes, image per scene). |
| 11 | YouTube upload | Step «الرفع إلى يوتيوب» | Video uploaded as **Private**; video id, title, description and publish date stored. |

## If a step fails

- The status page shows the step in "failed" with the exact error text.
- The background worker retries automatically with backoff; «إعادة المحاولة» forces an immediate retry.
- Steps that only wait on a missing prerequisite (no renderer, no YouTube channel) are marked
  as paused rather than failed, and resume by themselves once the prerequisite exists.

## After a green run

1. Turn «وضع الاختبار» off.
2. Create one real video (30–60 s) and confirm the same 11 steps.
3. Only then enable weekly scheduling.
