-- ============================================================
-- seed.sql  ·  Sample data for local testing
-- Run in Supabase SQL Editor AFTER 001_matching.sql
-- ============================================================

-- ── Seed users (inserted directly into auth.users) ───────────
-- These are fake accounts used only to own sample projects.

insert into auth.users (
  id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  aud, role,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    'a1000000-0000-0000-0000-000000000001',
    'maya.patel@berkeley.edu',
    '',
    now(), now(), now(),
    'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}', '{}'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'alex.chen@stanford.edu',
    '',
    now(), now(), now(),
    'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}', '{}'
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'daria.park@sjsu.edu',
    '',
    now(), now(), now(),
    'authenticated', 'authenticated',
    '{"provider":"email","providers":["email"]}', '{}'
  )
on conflict (id) do nothing;

-- ── Seed profiles for those users ────────────────────────────
insert into profiles (
  id, edu_email, demographic, name,
  vibe_blurb, skills, role,
  campus_id, last_meaningful_action_at, updated_at
) values
  (
    'a1000000-0000-0000-0000-000000000001',
    'maya.patel@berkeley.edu',
    'student',
    'Maya Patel',
    'Building mental health tools that actually fit how students live.',
    array['react native', 'python', 'figma', 'ui/ux'],
    'owner',
    'UC Berkeley',
    now(), now()
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'alex.chen@stanford.edu',
    'student',
    'Alex Chen',
    'AI + education nerd. Want to make studying feel less like a grind.',
    array['python', 'machine learning', 'react', 'node.js'],
    'owner',
    'Stanford',
    now(), now()
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'daria.park@sjsu.edu',
    'student',
    'Daria Park',
    'Hardware hacker building tools for student labs on a budget.',
    array['c++', 'python', 'arduino', 'mechanical'],
    'owner',
    'SJSU',
    now(), now()
  )
on conflict (id) do update set
  name = excluded.name,
  vibe_blurb = excluded.vibe_blurb,
  skills = excluded.skills,
  last_meaningful_action_at = excluded.last_meaningful_action_at,
  updated_at = excluded.updated_at;

-- ── Seed projects ─────────────────────────────────────────────
insert into projects (
  id, owner_id, title, vibe_blurb,
  required_skills, campus_id, active, created_at, updated_at
) values
  (
    'b2000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'Campus Mental Health App',
    'A safe space in your pocket. Anonymous peer support + therapist matching for college students.',
    array['react native', 'ui/ux', 'figma'],
    'UC Berkeley',
    true, now() - interval '2 days', now()
  ),
  (
    'b2000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000002',
    'AI Study Tool',
    'Upload your syllabus, get a personalized study plan that adapts as you go.',
    array['python', 'machine learning', 'react', 'node.js'],
    'Stanford',
    true, now() - interval '5 days', now()
  ),
  (
    'b2000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000003',
    'Open Source Lab Hardware',
    'Arduino-based sensor kits for student research labs — 10x cheaper than commercial options.',
    array['c++', 'python', 'mechanical'],
    'SJSU',
    true, now() - interval '1 day', now()
  ),
  (
    'b2000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000002',
    'Student Freelance Marketplace',
    'Upwork but for campus — hire students for short gigs, build your portfolio.',
    array['react', 'node.js', 'postgresql', 'ui/ux'],
    'Stanford',
    true, now() - interval '3 days', now()
  ),
  (
    'b2000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000001',
    'Research Paper Summarizer',
    'Paste any arXiv link, get a plain-English breakdown + related work suggestions.',
    array['python', 'llm', 'react'],
    'UC Berkeley',
    true, now() - interval '7 days', now()
  )
on conflict (id) do update set
  title = excluded.title,
  vibe_blurb = excluded.vibe_blurb,
  required_skills = excluded.required_skills,
  active = excluded.active,
  updated_at = excluded.updated_at;
