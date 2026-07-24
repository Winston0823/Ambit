-- ============================================================
-- projects_seed.sql · 6 temporary sample PROJECTS for the seeker deck
-- Run in the Supabase SQL Editor AFTER migration 028_project_seed_flag.sql.
--
-- 4 founder accounts (UUID namespace d4000000-…) own 6 active projects
-- (UUID namespace e5000000-…), all tagged is_seed=true. Skills are lowercase
-- canonical (overlap common seeker skills so they rank well). Covers are warm
-- editorial photos generated with Higgsfield (nano_banana_pro, hosted on its
-- CloudFront CDN). Founders carry a monster avatar_id (identity is a mark, not
-- a face) — real photos are gated behind mutual reveal.
-- ============================================================

-- ── Founder auth.users ───────────────────────────────────────
insert into auth.users (
  id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  aud, role,
  raw_app_meta_data, raw_user_meta_data
) values
  ('d4000000-0000-0000-0000-000000000001','nadia.okonkwo@usc.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('d4000000-0000-0000-0000-000000000002','ravi.menon@ucla.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('d4000000-0000-0000-0000-000000000003','grace.walker@usc.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('d4000000-0000-0000-0000-000000000004','leo.castellano@caltech.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}')
on conflict (id) do nothing;

-- ── Founder profiles (role=owner, is_seed=true, monster avatars) ─────
insert into profiles (
  id, edu_email, name,
  vibe_blurb, skills, role,
  avatar_id, open_to_nearby, response_rate,
  last_meaningful_action_at, updated_at, is_seed
) values
  ('d4000000-0000-0000-0000-000000000001','nadia.okonkwo@usc.edu','Nadia Okonkwo',
   'Building warmer ways for students to find their people on campus.',
   array['product strategy','ui/ux'],'owner','monster-01', true, 0.94, now(), now(), true),
  ('d4000000-0000-0000-0000-000000000002','ravi.menon@ucla.edu','Ravi Menon',
   'AI + education. Trying to make studying feel less like a grind.',
   array['python','machine learning'],'owner','monster-06', false, 0.88, now(), now(), true),
  ('d4000000-0000-0000-0000-000000000003','grace.walker@usc.edu','Grace Walker',
   'Designing tools that make good habits feel effortless.',
   array['figma','ui/ux'],'owner','monster-10', true, 0.91, now(), now(), true),
  ('d4000000-0000-0000-0000-000000000004','leo.castellano@caltech.edu','Leo Castellano',
   'Civic tech for campus — small tools, real impact.',
   array['web','typescript'],'owner','monster-03', false, 0.83, now(), now(), true)
on conflict (id) do update set
  name = excluded.name,
  vibe_blurb = excluded.vibe_blurb,
  role = excluded.role,
  avatar_id = excluded.avatar_id,
  open_to_nearby = excluded.open_to_nearby,
  response_rate = excluded.response_rate,
  last_meaningful_action_at = excluded.last_meaningful_action_at,
  updated_at = excluded.updated_at,
  is_seed = true;

-- ── Projects (active, is_seed=true, gradient covers) ─────────
insert into projects (
  id, owner_id, title, vibe_blurb,
  required_skills, roles_sought,
  image_url, needed_by, active, created_at, updated_at, is_seed
) values
  ('e5000000-0000-0000-0000-000000000001','d4000000-0000-0000-0000-000000000001',
   'Hearth','A warmer way to find your people on campus — events, not algorithms.',
   array['react native','typescript','ui/ux'], array['Mobile','Frontend'],
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260630_233410_9f7817fd-5854-4741-87f7-4bc1186f7d96.png', (now() + interval '21 days')::date, true, now() - interval '2 days', now(), true),

  ('e5000000-0000-0000-0000-000000000002','d4000000-0000-0000-0000-000000000002',
   'Lumen','Upload your syllabus, get a study plan that adapts as the semester moves.',
   array['python','machine learning','web'], array['ML / AI','Full Stack'],
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260630_233150_9403b51f-cd8f-4ea9-a26d-e425c9ff7c69.png', (now() + interval '30 days')::date, true, now() - interval '5 days', now(), true),

  ('e5000000-0000-0000-0000-000000000003','d4000000-0000-0000-0000-000000000001',
   'Tradepost','A trusted campus marketplace — textbooks, gigs, and sublets in one place.',
   array['typescript','web','python'], array['Full Stack','Backend'],
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260630_233152_96afc788-19de-41c8-a410-64f5bb8878d5.png', (now() + interval '28 days')::date, true, now() - interval '1 day', now(), true),

  ('e5000000-0000-0000-0000-000000000004','d4000000-0000-0000-0000-000000000003',
   'Cadence','A focus tracker that feels like a coach, not a chore.',
   array['react native','ui/ux','figma'], array['Mobile','Product Design'],
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260630_233154_716275b3-0a95-4791-a53e-4ce87e256aeb.png', (now() + interval '18 days')::date, true, now() - interval '3 days', now(), true),

  ('e5000000-0000-0000-0000-000000000005','d4000000-0000-0000-0000-000000000002',
   'Atlas','Paste any arXiv link — get a plain-English breakdown and what to read next.',
   array['python','web','machine learning'], array['ML / AI','Frontend'],
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260630_233157_1d2cfc88-1ece-4488-ac48-0afe4494a515.png', (now() + interval '35 days')::date, true, now() - interval '7 days', now(), true),

  ('e5000000-0000-0000-0000-000000000006','d4000000-0000-0000-0000-000000000004',
   'Verdant','A live sustainability map of campus — where to refill, recycle, repair.',
   array['web','typescript','ui/ux'], array['Frontend','Full Stack'],
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260630_233412_0c5fc713-9322-4e58-9bf8-21c78006da8a.png', (now() + interval '24 days')::date, true, now() - interval '4 days', now(), true)
on conflict (id) do update set
  title = excluded.title,
  vibe_blurb = excluded.vibe_blurb,
  required_skills = excluded.required_skills,
  roles_sought = excluded.roles_sought,
  active = excluded.active,
  updated_at = excluded.updated_at,
  is_seed = true;
