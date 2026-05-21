-- ============================================================
-- 001_matching.sql  ·  Ambit matching schema
-- Run this in the Supabase SQL Editor (or via supabase db push).
-- ============================================================

-- ── 0. Extensions ────────────────────────────────────────────
create extension if not exists vector;

-- ── 1. Profiles additions ────────────────────────────────────
-- Add columns that weren't in the initial profiles migration.
alter table profiles
  add column if not exists vibe_embedding    vector(1536),
  add column if not exists reliability_score smallint     not null default 50
    check (reliability_score between 0 and 100),
  add column if not exists last_meaningful_action_at timestamptz;

-- ── 2. skill_aliases ─────────────────────────────────────────
-- Canonical alias map: any raw string → its canonical form.
-- Used by normalize_skills() to collapse "React.js" → "react",
-- "ML" → "machine learning", etc.
create table if not exists skill_aliases (
  alias     text primary key,
  canonical text not null
);

insert into skill_aliases (alias, canonical) values
  -- JS ecosystem
  ('javascript',      'javascript'),
  ('js',              'javascript'),
  ('typescript',      'typescript'),
  ('ts',              'typescript'),
  ('react',           'react'),
  ('react.js',        'react'),
  ('reactjs',         'react'),
  ('react native',    'react native'),
  ('next.js',         'next.js'),
  ('nextjs',          'next.js'),
  ('node',            'node.js'),
  ('node.js',         'node.js'),
  ('nodejs',          'node.js'),
  -- Python
  ('python',          'python'),
  ('py',              'python'),
  ('fastapi',         'fastapi'),
  ('flask',           'flask'),
  ('django',          'django'),
  -- ML / AI
  ('machine learning','machine learning'),
  ('ml',              'machine learning'),
  ('deep learning',   'deep learning'),
  ('dl',              'deep learning'),
  ('pytorch',         'pytorch'),
  ('tensorflow',      'tensorflow'),
  ('tf',              'tensorflow'),
  ('llm',             'llm'),
  ('nlp',             'nlp'),
  ('computer vision', 'computer vision'),
  ('cv',              'computer vision'),
  -- Mobile
  ('swift',           'swift'),
  ('swiftui',         'swiftui'),
  ('kotlin',          'kotlin'),
  ('android',         'android'),
  ('ios',             'ios'),
  ('expo',            'expo'),
  -- Backend / infra
  ('go',              'go'),
  ('golang',          'go'),
  ('rust',            'rust'),
  ('java',            'java'),
  ('c++',             'c++'),
  ('cpp',             'c++'),
  ('c#',              'c#'),
  ('csharp',          'c#'),
  ('sql',             'sql'),
  ('postgres',        'postgresql'),
  ('postgresql',      'postgresql'),
  ('mysql',           'mysql'),
  ('mongodb',         'mongodb'),
  ('redis',           'redis'),
  ('graphql',         'graphql'),
  ('rest',            'rest api'),
  ('rest api',        'rest api'),
  ('docker',          'docker'),
  ('kubernetes',      'kubernetes'),
  ('k8s',             'kubernetes'),
  ('aws',             'aws'),
  ('gcp',             'gcp'),
  ('azure',           'azure'),
  ('supabase',        'supabase'),
  ('firebase',        'firebase'),
  -- Design
  ('figma',           'figma'),
  ('ui',              'ui/ux'),
  ('ux',              'ui/ux'),
  ('ui/ux',           'ui/ux'),
  ('product design',  'product design'),
  -- Business / other
  ('product management', 'product management'),
  ('pm',              'product management'),
  ('marketing',       'marketing'),
  ('growth',          'growth'),
  ('finance',         'finance'),
  ('blockchain',      'blockchain'),
  ('web3',            'web3'),
  ('solidity',        'solidity')
on conflict (alias) do nothing;

-- ── 3. normalize_skills helper ───────────────────────────────
-- Maps an input array through skill_aliases; unknown strings are
-- lowercased and kept as-is. Deduplicates via array_agg + distinct.
create or replace function normalize_skills(raw text[])
returns text[]
language sql
stable
as $$
  select array_agg(distinct coalesce(sa.canonical, lower(r.skill)))
  from   unnest(raw) as r(skill)
  left   join skill_aliases sa on sa.alias = lower(r.skill);
$$;

-- Trigger that auto-normalizes skills on profiles upsert
create or replace function trg_normalize_profile_skills()
returns trigger language plpgsql as $$
begin
  if new.skills is not null then
    new.skills := normalize_skills(new.skills);
  end if;
  return new;
end;
$$;
drop trigger if exists normalize_profile_skills on profiles;
create trigger normalize_profile_skills
  before insert or update of skills on profiles
  for each row execute function trg_normalize_profile_skills();

-- ── 4. projects table ────────────────────────────────────────
create table if not exists projects (
  id               uuid         primary key default gen_random_uuid(),
  owner_id         uuid         not null references auth.users(id) on delete cascade,
  title            text         not null,
  vibe_blurb       text         not null default '',
  required_skills  text[]       not null default '{}',
  campus_id        text,
  vibe_embedding   vector(1536),
  active           boolean      not null default true,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

-- Auto-normalize skills on project upsert too
create or replace function trg_normalize_project_skills()
returns trigger language plpgsql as $$
begin
  if new.required_skills is not null then
    new.required_skills := normalize_skills(new.required_skills);
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists normalize_project_skills on projects;
create trigger normalize_project_skills
  before insert or update of required_skills on projects
  for each row execute function trg_normalize_project_skills();

-- ── 5. matches table ─────────────────────────────────────────
-- Tracks what happened when a seeker met a project card.
-- outcome is null until the user acts; updated by client.
create table if not exists matches (
  id          uuid        primary key default gen_random_uuid(),
  seeker_id   uuid        not null references auth.users(id) on delete cascade,
  project_id  uuid        not null references projects(id)  on delete cascade,
  score       numeric(5,2),
  outcome     text        check (outcome in ('applied','skipped','saved')),
  created_at  timestamptz not null default now(),
  unique (seeker_id, project_id)
);

-- ── 6. compat_for_project RPC ────────────────────────────────
-- Returns ranked seekers compatible with a given project.
-- Called by project owners from the app; protected by RLS.
--
-- Scoring (0–100):
--   60% × skill_match_pct   — fraction of required skills the seeker has
--   25% × vibe_similarity   — cosine similarity of Voyage embeddings (0–1 → 0–100)
--   10% × reliability_score — starts at 50, updated by behaviour
--    5% × recency_boost     — linearly decays from 100→0 over 14 days of inactivity
--
-- Hard filters applied before scoring:
--   • seeker role is 'seeker' or 'both'
--   • seeker has been active in the last 30 days
--   • skills overlap ≥ 1

create or replace function compat_for_project(p_project_id uuid, p_limit int default 50)
returns table (
  seeker_id        uuid,
  score            numeric(5,2),
  skill_match_pct  numeric(5,2),
  vibe_similarity  numeric(5,2),
  reliability      smallint,
  recency_boost    numeric(5,2)
)
language sql
stable
security definer
as $$
  with proj as (
    select required_skills, vibe_embedding
    from   projects
    where  id = p_project_id and active = true
  ),
  scored as (
    select
      p.id                                                             as seeker_id,
      -- skill overlap: how many required skills the seeker has / total required
      case
        when array_length(proj.required_skills, 1) = 0 then 0
        else (
          select count(*)::numeric
          from   unnest(proj.required_skills) rs
          where  rs = any(p.skills)
        ) / array_length(proj.required_skills, 1)::numeric
      end                                                              as skill_match_pct,
      -- cosine similarity via pgvector (returns -1..1); clamp to 0..1
      case
        when proj.vibe_embedding is null or p.vibe_embedding is null then 0
        else greatest(0, 1 - (proj.vibe_embedding <=> p.vibe_embedding))
      end                                                              as vibe_sim,
      p.reliability_score                                              as reliability,
      -- recency: 100 if active today, 0 if inactive ≥14 days
      case
        when p.last_meaningful_action_at is null then 0
        else greatest(0,
          100 * (1 - extract(epoch from (now() - p.last_meaningful_action_at))
                     / (14 * 86400))
        )
      end                                                              as recency
    from profiles p, proj
    where p.role in ('seeker','both')
      and (p.last_meaningful_action_at is null
           or p.last_meaningful_action_at > now() - interval '30 days')
      -- hard filter: at least 1 skill overlap
      and exists (
        select 1 from unnest(proj.required_skills) rs
        where rs = any(p.skills)
      )
  )
  select
    seeker_id,
    round((
      60 * skill_match_pct
      + 25 * (vibe_sim * 100) / 100
      + 10 * reliability / 100
      +  5 * recency     / 100
    )::numeric, 2)                         as score,
    round((skill_match_pct * 100)::numeric, 2) as skill_match_pct,
    round((vibe_sim * 100)::numeric, 2)    as vibe_similarity,
    reliability,
    round(recency::numeric, 2)             as recency_boost
  from scored
  order by score desc
  limit p_limit;
$$;

-- ── 6b. compat_projects_for_seeker RPC ──────────────────────
-- Mirror of compat_for_project but from the seeker's perspective:
-- returns ranked active projects for a given seeker user.
-- Used by the discovery feed (S-020).
create or replace function compat_projects_for_seeker(p_seeker_id uuid, p_limit int default 30)
returns table (
  project_id       uuid,
  title            text,
  vibe_blurb       text,
  required_skills  text[],
  campus_id        text,
  owner_id         uuid,
  score            numeric(5,2),
  skill_match_pct  numeric(5,2),
  vibe_similarity  numeric(5,2)
)
language sql
stable
security definer
as $$
  with seeker as (
    select skills, vibe_embedding
    from   profiles
    where  id = p_seeker_id
  ),
  scored as (
    select
      pr.id,
      pr.title,
      pr.vibe_blurb,
      pr.required_skills,
      pr.campus_id,
      pr.owner_id,
      pr.created_at,
      -- skill match: fraction of required skills the seeker has
      case
        when array_length(pr.required_skills, 1) = 0 then 0
        else (
          select count(*)::numeric
          from   unnest(pr.required_skills) rs
          where  rs = any(seeker.skills)
        ) / array_length(pr.required_skills, 1)::numeric
      end                                                              as skill_match_pct,
      -- vibe similarity
      case
        when pr.vibe_embedding is null or seeker.vibe_embedding is null then 0
        else greatest(0, 1 - (pr.vibe_embedding <=> seeker.vibe_embedding))
      end                                                              as vibe_sim
    from projects pr, seeker
    where pr.active = true
      -- exclude own projects
      and pr.owner_id <> p_seeker_id
      -- exclude already-actioned projects
      and not exists (
        select 1 from matches m
        where m.seeker_id = p_seeker_id
          and m.project_id = pr.id
          and m.outcome in ('applied','skipped')
      )
  )
  select
    id              as project_id,
    title,
    vibe_blurb,
    required_skills,
    campus_id,
    owner_id,
    -- simplified score (no reliability/recency — those are seeker props, not project props)
    round((
      70 * skill_match_pct
      + 30 * vibe_sim
    )::numeric, 2)                          as score,
    round((skill_match_pct * 100)::numeric, 2) as skill_match_pct,
    round((vibe_sim * 100)::numeric, 2)     as vibe_similarity
  from scored
  order by score desc, created_at desc
  limit p_limit;
$$;

-- ── 7. Indexes ───────────────────────────────────────────────
-- HNSW vector indexes for fast ANN queries
create index if not exists idx_profiles_vibe_embedding
  on profiles using hnsw (vibe_embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists idx_projects_vibe_embedding
  on projects using hnsw (vibe_embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- GIN for skill array containment/overlap queries
create index if not exists idx_profiles_skills_gin
  on profiles using gin (skills);

create index if not exists idx_projects_required_skills_gin
  on projects using gin (required_skills);

-- Standard indexes
create index if not exists idx_projects_owner_id   on projects (owner_id);
create index if not exists idx_projects_active      on projects (active) where active = true;
create index if not exists idx_matches_seeker_id    on matches (seeker_id);
create index if not exists idx_matches_project_id   on matches (project_id);

-- ── 8. RLS ───────────────────────────────────────────────────
alter table projects enable row level security;
alter table matches  enable row level security;

-- Projects: anyone authenticated can read active projects;
-- only the owner can insert/update/delete their own.
create policy "projects: authenticated read active"
  on projects for select
  to authenticated
  using (active = true);

create policy "projects: owner insert"
  on projects for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "projects: owner update"
  on projects for update
  to authenticated
  using (owner_id = auth.uid());

create policy "projects: owner delete"
  on projects for delete
  to authenticated
  using (owner_id = auth.uid());

-- Matches: seeker sees their own rows; project owner sees rows for their projects.
create policy "matches: seeker read own"
  on matches for select
  to authenticated
  using (seeker_id = auth.uid());

create policy "matches: owner read for project"
  on matches for select
  to authenticated
  using (
    exists (
      select 1 from projects p
      where p.id = matches.project_id and p.owner_id = auth.uid()
    )
  );

create policy "matches: seeker insert"
  on matches for insert
  to authenticated
  with check (seeker_id = auth.uid());

create policy "matches: seeker update outcome"
  on matches for update
  to authenticated
  using (seeker_id = auth.uid());
