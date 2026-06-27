-- ============================================================
-- seekers_seed.sql · 10 temporary SEEKER profiles for the discovery feed
-- Run in the Supabase SQL Editor AFTER migration 026_seed_flag.sql.
--
-- Every row is tagged is_seed=true and uses the fixed UUID namespace
-- c3000000-0000-0000-0000-0000000000NN, so seekers_wipe.sql can remove
-- them cleanly. Photos are Higgsfield CDN URLs (soul_2). Skills are
-- lowercase canonical so they match projects.required_skills (which the
-- normalize trigger also lowercases) — each seeker overlaps the common
-- engineering/design skills, so they surface on the discovery deck.
-- ============================================================

-- ── auth.users (FK target for profiles) ──────────────────────
insert into auth.users (
  id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  aud, role,
  raw_app_meta_data, raw_user_meta_data
) values
  ('c3000000-0000-0000-0000-000000000001','sofia.restrepo@usc.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('c3000000-0000-0000-0000-000000000002','marcus.lee@usc.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('c3000000-0000-0000-0000-000000000003','priya.nair@ucla.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('c3000000-0000-0000-0000-000000000004','diego.alvarez@usc.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('c3000000-0000-0000-0000-000000000005','hannah.cohen@ucla.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('c3000000-0000-0000-0000-000000000006','kwame.mensah@usc.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('c3000000-0000-0000-0000-000000000007','emily.zhang@caltech.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('c3000000-0000-0000-0000-000000000008','jordan.brooks@ucla.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('c3000000-0000-0000-0000-000000000009','aisha.rahman@usc.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}'),
  ('c3000000-0000-0000-0000-000000000010','tyler.nguyen@usc.edu','',now(),now(),now(),'authenticated','authenticated','{"provider":"email","providers":["email"]}','{}')
on conflict (id) do nothing;

-- ── profiles (role=seeker, is_seed=true) ─────────────────────
insert into profiles (
  id, edu_email, demographic, name,
  vibe_blurb, skills, role,
  campus_id, photo_url,
  last_meaningful_action_at, updated_at, is_seed
) values
  ('c3000000-0000-0000-0000-000000000001','sofia.restrepo@usc.edu','student','Sofia Restrepo',
   'Frontend dev obsessed with the last 10% of polish. Shipped two campus apps students actually use.',
   array['typescript','web','react native','ui/ux'],'seeker','usc',
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260627_063007_6d1d9435-90ea-4e6b-9c0b-163da58fcdeb.png',
   now(),now(),true),

  ('c3000000-0000-0000-0000-000000000002','marcus.lee@usc.edu','student','Marcus Lee',
   'Product designer who codes. I prototype in Figma and ship the real thing in React.',
   array['figma','ui/ux','prototyping','web'],'seeker','usc',
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260627_063129_04998f38-d0e8-4b58-84f8-b7ba47e13e55.png',
   now(),now(),true),

  ('c3000000-0000-0000-0000-000000000003','priya.nair@ucla.edu','student','Priya Nair',
   'ML student into recsys and clean dataviz. I turn messy data into something you can actually decide with.',
   array['python','machine learning','data science'],'seeker','ucla',
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260627_063131_7e74524d-cff2-402f-885d-7bb41da4a599.png',
   now(),now(),true),

  ('c3000000-0000-0000-0000-000000000004','diego.alvarez@usc.edu','student','Diego Alvarez',
   'Backend + infra. I like building systems that don''t fall over at 2am.',
   array['python','go','devops','web'],'seeker','usc',
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260627_063133_2d3cc38f-d4f6-4f24-b636-06365144a014.png',
   now(),now(),true),

  ('c3000000-0000-0000-0000-000000000005','hannah.cohen@ucla.edu','student','Hannah Cohen',
   'Product + UX research. I talk to users until the real problem is obvious, then we build that.',
   array['user research','product strategy','ui/ux'],'seeker','ucla',
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260627_063135_fac31bf5-9c1b-44ac-9b3f-91b856dcf358.png',
   now(),now(),true),

  ('c3000000-0000-0000-0000-000000000006','kwame.mensah@usc.edu','student','Kwame Mensah',
   'Mobile engineer. Built a campus transit app used by 3k students last semester.',
   array['swift','ios','react native','typescript'],'seeker','usc',
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260627_063137_e946fd13-ed93-47e8-adc5-866f29266a1b.png',
   now(),now(),true),

  ('c3000000-0000-0000-0000-000000000007','emily.zhang@caltech.edu','student','Emily Zhang',
   'Low-level + ML. Currently obsessed with making model inference embarrassingly fast.',
   array['python','rust','machine learning'],'seeker','caltech',
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260627_063140_ec75bda9-74dc-4e7d-bc80-d5826d62f28b.png',
   now(),now(),true),

  ('c3000000-0000-0000-0000-000000000008','jordan.brooks@ucla.edu','student','Jordan Brooks',
   'Growth person. I find the one channel that works and pour fuel on it.',
   array['growth strategy','marketing','web'],'seeker','ucla',
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260627_063145_d1b4c6fa-b640-456c-b6ac-be26f54ffe1a.png',
   now(),now(),true),

  ('c3000000-0000-0000-0000-000000000009','aisha.rahman@usc.edu','student','Aisha Rahman',
   'Motion + interaction designer. The details are the design — I sweat the easing curves.',
   array['figma','motion','prototyping','ui/ux'],'seeker','usc',
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260627_063148_22ab802b-68e9-451d-8b22-34f39841cfe9.png',
   now(),now(),true),

  ('c3000000-0000-0000-0000-000000000010','tyler.nguyen@usc.edu','student','Tyler Nguyen',
   'Full-stack generalist. I like turning a vague idea into a working v1 by the weekend.',
   array['typescript','web','python','devops'],'seeker','usc',
   'https://d8j0ntlcm91z4.cloudfront.net/user_3EjWWk4OUvtlMuKyfHCmygCk9Mb/hf_20260627_063238_f1adcca3-5fc9-4412-a473-a870e9bc5264.png',
   now(),now(),true)
on conflict (id) do update set
  name = excluded.name,
  vibe_blurb = excluded.vibe_blurb,
  skills = excluded.skills,
  photo_url = excluded.photo_url,
  campus_id = excluded.campus_id,
  role = excluded.role,
  last_meaningful_action_at = excluded.last_meaningful_action_at,
  updated_at = excluded.updated_at,
  is_seed = true;

-- ── portfolio_items (screen-2 work samples, is_seed=true) ─────
-- Clear any prior seed portfolio for these users first so re-running this
-- file is idempotent (profiles/auth.users use on-conflict; portfolio rows
-- have generated ids, so without this a re-run would duplicate them).
delete from portfolio_items where user_id::text like 'c3000000-0000-0000-0000-%';

-- Deterministic picsum images (stable per seed slug). Two per seeker.
insert into portfolio_items (user_id, title, description, image_url, position, is_seed) values
  ('c3000000-0000-0000-0000-000000000001','Hearth — campus events app','Anonymous, location-aware feed for dorm events. Built the whole frontend in React Native; 1.2k weekly actives.','https://picsum.photos/seed/sofia1/800/1000',0,true),
  ('c3000000-0000-0000-0000-000000000001','Design system refresh','Rebuilt our club site on a token-driven system. Cut new-page build time in half.','https://picsum.photos/seed/sofia2/800/1000',1,true),

  ('c3000000-0000-0000-0000-000000000002','Figma → React handoff kit','A component library that maps 1:1 between Figma variants and coded props. Used by 4 campus teams.','https://picsum.photos/seed/marcus1/800/1000',0,true),
  ('c3000000-0000-0000-0000-000000000002','Onboarding redesign','Reworked a 9-step signup into 4. Completion went from 48% to 71% in the pilot.','https://picsum.photos/seed/marcus2/800/1000',1,true),

  ('c3000000-0000-0000-0000-000000000003','Course recommender','Built a recsys for our course catalog using collaborative filtering. Top-5 hit rate ~0.6.','https://picsum.photos/seed/priya1/800/1000',0,true),
  ('c3000000-0000-0000-0000-000000000003','Campus data dashboard','Cleaned and visualized 5 years of org-fair data so clubs could see what actually drives signups.','https://picsum.photos/seed/priya2/800/1000',1,true),

  ('c3000000-0000-0000-0000-000000000004','Realtime grade-tracker API','Go service + Postgres handling 200 rps at finals. Zero downtime across two semesters.','https://picsum.photos/seed/diego1/800/1000',0,true),
  ('c3000000-0000-0000-0000-000000000004','CI/CD for the robotics club','Set up reproducible builds + deploy so the team stopped shipping from laptops.','https://picsum.photos/seed/diego2/800/1000',1,true),

  ('c3000000-0000-0000-0000-000000000005','Dining-hall UX study','Ran 14 interviews + a diary study; the findings reshaped a campus app''s whole nav.','https://picsum.photos/seed/hannah1/800/1000',0,true),
  ('c3000000-0000-0000-0000-000000000005','Accessibility audit','Audited and fixed a student-gov site against WCAG AA. Shipped the fixes with the eng team.','https://picsum.photos/seed/hannah2/800/1000',1,true),

  ('c3000000-0000-0000-0000-000000000006','Transit — bus tracker','SwiftUI app with live shuttle ETAs. 3k students, 4.8 on TestFlight.','https://picsum.photos/seed/kwame1/800/1000',0,true),
  ('c3000000-0000-0000-0000-000000000006','Offline-first notes','React Native notes app that syncs when you''re back online. My take on local-first.','https://picsum.photos/seed/kwame2/800/1000',1,true),

  ('c3000000-0000-0000-0000-000000000007','Fast inference kernels','Hand-tuned Rust kernels that cut a vision model''s latency 3x on CPU.','https://picsum.photos/seed/emilyz1/800/1000',0,true),
  ('c3000000-0000-0000-0000-000000000007','Tiny LLM eval harness','Open-source harness for benchmarking small models on a budget. 300+ GitHub stars.','https://picsum.photos/seed/emilyz2/800/1000',1,true),

  ('c3000000-0000-0000-0000-000000000008','0→1k waitlist','Ran the launch for a campus marketplace. Hit 1k signups in 3 weeks on one channel.','https://picsum.photos/seed/jordan1/800/1000',0,true),
  ('c3000000-0000-0000-0000-000000000008','Referral loop teardown','Designed a referral loop that drove 40% of new signups for a club tool.','https://picsum.photos/seed/jordan2/800/1000',1,true),

  ('c3000000-0000-0000-0000-000000000009','Motion language for an app','Defined the easing + transition system for a student app. Made it feel alive without lag.','https://picsum.photos/seed/aisha1/800/1000',0,true),
  ('c3000000-0000-0000-0000-000000000009','Interactive zine','A scrollytelling piece on campus history. Won a small design award.','https://picsum.photos/seed/aisha2/800/1000',1,true),

  ('c3000000-0000-0000-0000-000000000010','Weekend v1: study-swap','Built a full study-partner matcher in a weekend. TS + Postgres, deployed and used.','https://picsum.photos/seed/tyler1/800/1000',0,true),
  ('c3000000-0000-0000-0000-000000000010','Internal tools for a club','Replaced three spreadsheets with one small app. Saved the team hours every week.','https://picsum.photos/seed/tyler2/800/1000',1,true);
