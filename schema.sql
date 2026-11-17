-- =====================================================================
-- Socialdia Agency: database, security rules and starter content
-- Run this whole file once in Supabase: SQL Editor > New query > Run.
-- Safe to run again: it only adds what is missing.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- admins ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admins read" on public.admins;
create policy "admins read" on public.admins for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.add_admin(p_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'user not found: create this user in Authentication > Users first'; end if;
  insert into public.admins (user_id, email) values (uid, lower(trim(p_email))) on conflict (user_id) do nothing;
end $$;
revoke all on function public.add_admin(text) from public;
grant execute on function public.add_admin(text) to authenticated;

create or replace function public.remove_admin(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_user = auth.uid() then raise exception 'you cannot remove yourself'; end if;
  delete from public.admins where user_id = p_user;
end $$;
revoke all on function public.remove_admin(uuid) from public;
grant execute on function public.remove_admin(uuid) to authenticated;

-- ---------- helper: updated_at ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- settings (one row per group, value is JSON) ----------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- story scenes ----------
create table if not exists public.scenes (
  key text primary key,
  sort int not null default 0,
  visible boolean not null default true,
  name_ar text not null default '', name_en text not null default '',
  slate text not null default '',
  title_ar text not null default '', title_en text not null default '',
  lede_ar text not null default '',  lede_en text not null default '',
  link_label_ar text not null default '', link_label_en text not null default '', link_href text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- services ----------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sort int not null default 0,
  visible boolean not null default true,
  title_ar text not null default '', title_en text not null default '',
  short_ar text not null default '',  short_en text not null default '',
  body_ar text not null default '',   body_en text not null default '',
  icon text not null default 'spark',
  image text not null default '',
  scenes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- portfolio ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sort int not null default 0,
  visible boolean not null default true,
  featured boolean not null default false,
  title_ar text not null default '', title_en text not null default '',
  client text not null default '',
  category_ar text not null default '', category_en text not null default '',
  year text not null default '',
  summary_ar text not null default '', summary_en text not null default '',
  body_ar text not null default '', body_en text not null default '',
  cover text not null default '',
  gallery jsonb not null default '[]'::jsonb,
  video text not null default '',
  link text not null default '',
  results jsonb not null default '[]'::jsonb,
  tags text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- pages ----------
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  published boolean not null default true,
  title_ar text not null default '', title_en text not null default '',
  seo_title_ar text not null default '', seo_title_en text not null default '',
  seo_desc_ar text not null default '',  seo_desc_en text not null default '',
  og_image text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  show_in_nav boolean not null default false,
  nav_label_ar text not null default '', nav_label_en text not null default '',
  nav_sort int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- extra header links (home, external links, anchors) ----------
create table if not exists public.nav_items (
  id uuid primary key default gen_random_uuid(),
  sort int not null default 0,
  visible boolean not null default true,
  label_ar text not null default '', label_en text not null default '',
  href text not null default '/',
  new_tab boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------- testimonials / clients ----------
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  sort int not null default 0,
  visible boolean not null default true,
  name text not null default '',
  role_ar text not null default '', role_en text not null default '',
  text_ar text not null default '', text_en text not null default '',
  avatar text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  sort int not null default 0,
  visible boolean not null default true,
  name text not null default '',
  logo text not null default '',
  url text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- contact messages ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null default '',
  phone text not null default '',
  subject text not null default '',
  message text not null,
  page text not null default '',
  read boolean not null default false,
  starred boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- redirects ----------
create table if not exists public.redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,
  to_url text not null,
  permanent boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['settings','scenes','services','projects','pages','nav_items','testimonials','clients'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------- row level security ----------
do $$
declare t text;
begin
  foreach t in array array['settings','scenes','services','projects','pages','nav_items','testimonials','clients','messages','redirects'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('create policy "admin all" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists "public read" on public.settings;     create policy "public read" on public.settings     for select using (true);
drop policy if exists "public read" on public.redirects;    create policy "public read" on public.redirects    for select using (true);
drop policy if exists "public read" on public.scenes;       create policy "public read" on public.scenes       for select using (visible);
drop policy if exists "public read" on public.services;     create policy "public read" on public.services     for select using (visible);
drop policy if exists "public read" on public.projects;     create policy "public read" on public.projects     for select using (visible);
drop policy if exists "public read" on public.nav_items;    create policy "public read" on public.nav_items    for select using (visible);
drop policy if exists "public read" on public.testimonials; create policy "public read" on public.testimonials for select using (visible);
drop policy if exists "public read" on public.clients;      create policy "public read" on public.clients      for select using (visible);
drop policy if exists "public read" on public.pages;        create policy "public read" on public.pages        for select using (published);

drop policy if exists "anyone can send a message" on public.messages;
create policy "anyone can send a message" on public.messages for insert to anon, authenticated
  with check (char_length(name) between 1 and 200 and char_length(message) between 2 and 5000 and read = false and starred = false);

-- ---------- media storage ----------
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
drop policy if exists "media admin all" on storage.objects;
create policy "media admin all" on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

-- ---------- starter content ----------
insert into public.settings (key, value) values
  ('general', $j${"brand_name": "Socialdia Agency", "brand_short": "Socialdia", "tagline_ar": "إحنا مش بننشر.. إحنا بنؤدي", "tagline_en": "We don't post.. we perform", "country_ar": "مصر", "country_en": "Egypt", "logo": "/assets/logo.jpg", "logo_mark": "/assets/logo-mark.jpg", "footer_text_ar": "وكالة تسويق ومحتوى وتصميم وتطوير مواقع. بنحكي حكاية براندك من أول فكرة لحد النجاح.", "footer_text_en": "A marketing, content, design and web development agency. We tell your brand's story from the first idea to success.", "copyright": "© 2026 Socialdia Agency"}$j$::jsonb),
  ('contact', $j${"whatsapp": "", "phone": "", "email": "", "address_ar": "", "address_en": "", "hours_ar": "", "hours_en": "", "map_url": ""}$j$::jsonb),
  ('social', $j${"instagram": "", "facebook": "", "tiktok": "", "youtube": "", "linkedin": "", "x": "", "behance": "", "snapchat": "", "telegram": ""}$j$::jsonb),
  ('theme', $j${"accent": "#D6065F", "accent_dark": "#FF5C9E", "pop": "#FFEB6E", "sky": "#A8DDE9", "violet": "#B04BB5", "leaf": "#5DAA73"}$j$::jsonb),
  ('features', $j${"intro": "session", "enable_3d": true, "effects": true, "whatsapp_button": true, "theme_toggle": true, "lang_toggle": true, "default_lang": "ar", "default_theme": "system", "scene_bar": true}$j$::jsonb),
  ('seo', $j${"title_ar": "Socialdia Agency | وكالة تسويق ومحتوى وتصميم", "title_en": "Socialdia Agency | Marketing, content and design", "desc_ar": "Socialdia Agency وكالة مصرية للتسويق عبر السوشيال ميديا وصناعة المحتوى والتصميم وتطوير المواقع والتطبيقات.", "desc_en": "Socialdia Agency is an Egyptian agency for social media marketing, content, design and web and app development.", "og_image": "/assets/logo.jpg", "site_url": "", "index": true}$j$::jsonb),
  ('code', $j${"head": "", "body_end": "", "css": ""}$j$::jsonb),
  ('announcement', $j${"enabled": false, "text_ar": "", "text_en": "", "url": ""}$j$::jsonb),
  ('home', $j${"hero_slate": "Title card", "hero_reel": "Reel 2026", "hero_title_ar": "كل نجاح وراه حكاية. [[بنحكيها معاك]] من أول فكرة.", "hero_title_en": "Every success has a story. [[We tell it with you,]] from the first idea.", "hero_lede_ar": "ثمانية مشاهد بتاخد براندك من أول فكرة لحد ما يبقى له جمهور بيكبر. اسحب لتحت وشوف الشغل وهو بيتعمل.", "hero_lede_en": "Eight scenes take your brand from the first idea to an audience that keeps growing. Scroll down and watch the work happen.", "hero_cta_ar": "ابدأ الحكاية", "hero_cta_en": "Start the story", "stats": [{"value": 8, "label_ar": "مشهد في الحكاية", "label_en": "scenes in the story"}, {"value": 10, "label_ar": "خدمة تحت سقف واحد", "label_en": "services under one roof"}, {"value": 1, "label_ar": "فريق من الفكرة للنجاح", "label_en": "team from idea to success"}], "credits_title_ar": "الخدمات اللي ورا كل مشهد.", "credits_title_en": "The services behind every scene.", "finale_title_ar": "عندك فكرة؟ خلّينا نصوّر المشهد الأول.", "finale_title_en": "Got an idea? Let's shoot scene one.", "finale_btn_ar": "تواصل معانا", "finale_btn_en": "Contact us", "finale_btn_url": "/contact", "finale_btn2_ar": "ارجع لأول الحكاية", "finale_btn2_en": "Back to the start"}$j$::jsonb)
on conflict (key) do nothing;

insert into public.scenes (key,sort,visible,name_ar,name_en,slate,title_ar,title_en,lede_ar,lede_en,link_label_ar,link_label_en,link_href) values
  ('idea',1,true,'الفكرة','Idea','Idea','كل حاجة بتبدأ بسؤال.','Everything starts with a question.','بنقعد مع صاحب البراند ونسمع: عايز إيه، ولمين، وإيه اللي بيفرّقك عن غيرك. قبل أي تصميم أو كاميرا، بنحدد الاتجاه الإبداعي وصوت البراند.','We sit down with the brand owner and listen: what you want, for whom, and what sets you apart. Before any design or camera, we set the creative direction and the voice of the brand.','','',''),
  ('design',2,true,'التصميم','Design','Design','نديها شكل.','Give it a face.','الهوية والألوان والخطوط، وبعدها شاشات الموقع والتطبيق. كل عنصر بنرسمه بيخدم الفكرة، والناس بتعرفه من أول نظرة.','Identity, colors and typography, then the screens of the website and app. Every element serves the idea and people recognize it at first glance.','','',''),
  ('planning',3,true,'التخطيط','Planning','Planning','خطة تمشي عليها.','A plan you can follow.','بنبني استراتيجية التسويق وتقويم المحتوى: القنوات، الإعلانات، المواعيد، والأرقام اللي هنقيس بيها. كل بوست له يوم وله سبب.','We build the marketing strategy and the content calendar: channels, ads, timing, and the numbers we will measure. Every post has a day and a reason.','','',''),
  ('build',4,true,'التنفيذ','Build','Build','نبني اللي اتخطط.','We build what was planned.','مواقع ومتاجر إلكترونية وتطبيقات بكود نضيف وسريع، وبتتجرب على كل الشاشات قبل التسليم.','Websites, online stores and apps with clean, fast code, tested on every screen before delivery.','','',''),
  ('shoot',5,true,'التصوير','Shoot','Shoot','الكاميرا شغّالة.','Cameras rolling.','تصوير منتجات وإعلانات وريلز، وإدارة شغل المؤثرين والمشاهير قدّام الكاميرا ووراها. فريق واحد ماسك الإضاءة والكادر والأداء.','Product shoots, ads and Reels, plus managing influencers and celebrities in front of the camera and behind it. One team on lighting, framing and performance.','','',''),
  ('edit',6,true,'المونتاج','Edit','Edit','نقص ونركّب ونظبط الإيقاع.','Cut, layer, find the rhythm.','من اللقطات الخام لفيديو يمسك المشاهد لآخره: قص، ألوان، صوت، موشن جرافيك وترجمة.','From raw footage to a video people watch to the end: cutting, color, sound, motion graphics and captions.','','',''),
  ('publish',7,true,'النشر','Publish','Publish','نضغط نشر، ونتابع.','Hit publish, then watch.','بننشر في أنسب وقت لجمهورك، ونرد على التعليقات، ونقيس الأداء كل أسبوع عشان الجولة الجاية تطلع أحسن.','We post when your audience is most active, answer comments, and measure performance weekly so the next round is better.','','',''),
  ('success',8,true,'النجاح','Success','Success','ونفرح بنجاحك.','Then we celebrate your win.','اللي بدأ فكرة بقى براند ليه جمهور وعملاء بيرجعوله. وإحنا فاضلين معاك نكتب الفصل الجاي.','What began as an idea is now a brand with an audience and customers who return. And we stay with you to write the next chapter.','شوف كل الخدمات ↓','See all services ↓','#credits')
on conflict (key) do nothing;

insert into public.services (slug,sort,title_ar,title_en,short_ar,short_en,icon,scenes) values
  ('social-media-marketing',1,'التسويق عبر السوشيال ميديا','Social Media Marketing','حملات مدروسة تصل لجمهورك الصح وتحوّل المتابعين لعملاء.','Planned campaigns that reach the right audience and turn followers into customers.','megaphone',$j$["planning"]$j$::jsonb),
  ('social-media-management',2,'إدارة حسابات السوشيال ميديا','Social Media Management','إدارة يومية لحساباتك: محتوى ونشر وردود وتقارير أداء.','Day-to-day management of your accounts: content, posting, replies and performance reports.','chart',$j$["planning", "publish"]$j$::jsonb),
  ('influencers-media-management',3,'إدارة المحتوى الإعلامي للمؤثرين','Influencers Media Management','ترشيح المؤثرين المناسبين وإدارة التعاون معاهم من الاتفاق لحد النتائج.','Finding the right influencers and managing the collaboration from agreement to results.','users',$j$["shoot", "publish"]$j$::jsonb),
  ('creative-content-direction',4,'الإدارة الإبداعية للمحتوى','Creative Content Direction','اتجاه إبداعي وصوت واضح للبراند يمشي في كل محتوى بتنشره.','A creative direction and a clear brand voice that runs through everything you publish.','spark',$j$["idea", "shoot"]$j$::jsonb),
  ('video-editing',5,'المونتاج وتحرير الفيديو','Video Editing','مونتاج ريلز وإعلانات وفيديوهات طويلة بإيقاع يمسك المشاهد.','Editing for Reels, ads and long-form video with a rhythm that holds viewers.','video',$j$["edit"]$j$::jsonb),
  ('graphic-design',6,'التصميم الجرافيكي','Graphic Design','هويات بصرية وتصميمات سوشيال ميديا ومطبوعات بشكل متناسق.','Visual identities, social media designs and print work with a consistent look.','pen',$j$["design"]$j$::jsonb),
  ('ux-ui-design',7,'تصميم تجربة وواجهة المستخدم','UX/UI Design','واجهات وتجارب استخدام سهلة لمواقعك وتطبيقاتك.','Interfaces and user experiences that are easy to use for your websites and apps.','layers',$j$["design"]$j$::jsonb),
  ('web-development',8,'تطوير المواقع الإلكترونية','Web Development','مواقع سريعة وآمنة وبتشتغل على كل الشاشات.','Fast, secure websites that work on every screen.','code',$j$["build"]$j$::jsonb),
  ('ecommerce-development',9,'تطوير مواقع وتطبيقات المتاجر الإلكترونية','eCommerce Website and App Development','متاجر إلكترونية وتطبيقات بيع بتجربة شراء سلسة.','Online stores and shopping apps with a smooth buying experience.','cart',$j$["build"]$j$::jsonb),
  ('celebrity-account-management',10,'إدارة حسابات المشاهير','Celebrity Account Management','إدارة حسابات المشاهير بخصوصية واحترافية وهوية ثابتة.','Managing celebrity accounts with privacy, professionalism and a consistent identity.','star',$j$["shoot"]$j$::jsonb)
on conflict (slug) do nothing;

insert into public.pages (slug,published,title_ar,title_en,show_in_nav,nav_label_ar,nav_sort,blocks) values
  ('services',true,'الخدمات','Services',true,'',10,$j$[{"id": "b1", "type": "hero", "props": {"eyebrow_ar": "ما نقدمه", "eyebrow_en": "What we do", "title_ar": "خدماتنا", "title_en": "Our services", "text_ar": "من الفكرة لحد النشر، كل اللي براندك محتاجه تحت سقف واحد.", "text_en": "From the first idea to publishing, everything your brand needs under one roof.", "image": "", "cta_ar": "", "cta_en": "", "cta_url": "", "cta2_ar": "", "cta2_en": "", "cta2_url": "", "align": "start"}}, {"id": "b2", "type": "services", "props": {"title_ar": "", "title_en": "", "text_ar": "", "text_en": "", "layout": "grid", "limit": 0}}]$j$::jsonb),
  ('work',true,'أعمالنا','Our work',true,'',20,$j$[{"id": "b1", "type": "hero", "props": {"eyebrow_ar": "شغلنا", "eyebrow_en": "Portfolio", "title_ar": "أعمالنا", "title_en": "Our work", "text_ar": "نماذج من الحكايات اللي حكيناها مع عملائنا.", "text_en": "A selection of the stories we told with our clients.", "image": "", "cta_ar": "", "cta_en": "", "cta_url": "", "cta2_ar": "", "cta2_en": "", "cta2_url": "", "align": "start"}}, {"id": "b2", "type": "projects", "props": {"title_ar": "", "title_en": "", "text_ar": "", "text_en": "", "filter": "all", "category": "", "limit": 0, "show_filters": true}}]$j$::jsonb),
  ('about',true,'من نحن','About us',true,'',30,$j$[{"id": "b1", "type": "hero", "props": {"eyebrow_ar": "عن الوكالة", "eyebrow_en": "About the agency", "title_ar": "من نحن", "title_en": "About us", "text_ar": "Socialdia Agency وكالة مصرية للتسويق والمحتوى والتصميم وتطوير المواقع. بنشتغل مع البراندات من الفكرة لحد النجاح.", "text_en": "Socialdia Agency is an Egyptian agency for marketing, content, design and web development. We work with brands from the first idea to success.", "image": "", "cta_ar": "", "cta_en": "", "cta_url": "", "cta2_ar": "", "cta2_en": "", "cta2_url": "", "align": "start"}}, {"id": "b2", "type": "clients", "props": {"title_ar": "عملاء وثقوا فينا", "title_en": "Clients who trusted us"}}]$j$::jsonb),
  ('contact',true,'تواصل معنا','Contact',true,'',40,$j$[{"id": "b1", "type": "hero", "props": {"eyebrow_ar": "نبدأ؟", "eyebrow_en": "Shall we start?", "title_ar": "تواصل معنا", "title_en": "Contact us", "text_ar": "احكيلنا عن فكرتك، وإحنا نرد عليك في أقرب وقت.", "text_en": "Tell us about your idea and we will get back to you soon.", "image": "", "cta_ar": "", "cta_en": "", "cta_url": "", "cta2_ar": "", "cta2_en": "", "cta2_url": "", "align": "start"}}, {"id": "b2", "type": "contact", "props": {"title_ar": "ابعتلنا رسالة", "title_en": "Send us a message", "text_ar": "", "text_en": "", "show_info": true}}]$j$::jsonb),
  ('_home',true,'صفحة الرئيسية (أقسام إضافية)','Home extra sections',false,'',100,$j$[{"id": "h1", "type": "projects", "props": {"title_ar": "أحدث أعمالنا", "title_en": "Latest work", "text_ar": "", "text_en": "", "filter": "featured", "category": "", "limit": 6, "show_filters": false}}, {"id": "h2", "type": "testimonials", "props": {"title_ar": "قالوا عننا", "title_en": "What clients say", "limit": 6}}, {"id": "h3", "type": "clients", "props": {"title_ar": "عملاء وثقوا فينا", "title_en": "Clients who trusted us"}}]$j$::jsonb)
on conflict (slug) do nothing;

insert into public.nav_items (sort,label_ar,label_en,href)
select 0,'الرئيسية','Home','/'
where not exists (select 1 from public.nav_items);

-- =====================================================================
-- Make your two admin accounts
-- 1) In Supabase: Authentication > Users > Add user, create both accounts
--    (email + password, tick "Auto Confirm User").
-- 2) Put the two emails below, then run this block.
-- =====================================================================
insert into public.admins (user_id, email)
select id, email from auth.users
where lower(email) in (lower('ADMIN_ONE@example.com'), lower('ADMIN_TWO@example.com'))
on conflict (user_id) do nothing;
