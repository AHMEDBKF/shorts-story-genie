CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;

  INSERT INTO public.automation_schedules (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  INSERT INTO public.topics (user_id, title, slug, category)
  SELECT NEW.id, t.title, t.slug, t.category FROM (VALUES
    ('الصدق','honesty','قيم'),
    ('المشاركة','sharing','قيم'),
    ('النظافة','cleanliness','عادات'),
    ('الأرقام','numbers','تعليم'),
    ('الألوان','colors','تعليم'),
    ('الحيوانات','animals','تعليم'),
    ('الحروف','alphabet','تعليم'),
    ('الصداقة','friendship','قيم'),
    ('السلامة','safety','عادات'),
    ('الاحترام','respect','قيم'),
    ('العادات الحسنة','good-habits','عادات'),
    ('التعاون','teamwork','قيم'),
    ('الصبر','patience','قيم'),
    ('شكر الوالدين','gratitude-parents','قيم')
  ) AS t(title, slug, category)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.ai_providers (user_id, capability, key, label, cost_tier, priority, enabled)
  SELECT NEW.id, p.capability::public.provider_capability, p.key, p.label, p.tier::public.cost_tier, p.priority, true
  FROM (VALUES
    ('text','lovable-text','نصوص Lovable AI','low',5),
    ('image','lovable-image','صور Lovable AI','low',5),
    ('voice','lovable-voice','صوت Lovable AI','low',5),
    ('text','mock-text','مولّد نصوص تجريبي','free',10),
    ('image','mock-image','مولّد صور تجريبي','free',10),
    ('voice','mock-voice','مولّد صوت تجريبي','free',10),
    ('music','mock-music','موسيقى تجريبية','free',10)
  ) AS p(capability, key, label, tier, priority)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $function$;