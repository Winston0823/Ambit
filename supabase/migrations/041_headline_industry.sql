-- ============================================================
-- 041_headline_industry.sql · Discovery v2 card fields.
--
-- Seeker cards lead with the person's work, not titles — but the
-- header still carries a short professional line ("Full-stack & ML
-- Engineer") under the name: profiles.headline. Project cards get an
-- industry/topic line under the title: projects.industry.
-- ============================================================

-- ── 1. profiles.headline ────────────────────────────────────
alter table profiles
  add column if not exists headline text not null default '';

-- 039 revoked table-level SELECT on profiles and re-granted it
-- column-by-column (photo_url lockdown). A new column is NOT covered
-- by those grants, so it needs its own — for both roles, matching
-- 039's defense-in-depth pattern.
grant select (headline) on profiles to authenticated;
grant select (headline) on profiles to anon;

-- ── 2. projects.industry ────────────────────────────────────
-- Free-text industry/topic ("Campus networking", "Fintech", …).
-- projects kept its default table-level SELECT, so no grant needed.
alter table projects
  add column if not exists industry text not null default '';

-- ── 3. Seeker-deck RPC returns industry ─────────────────────
-- compat_projects_for_seeker feeds the seeker's project cards; the
-- v2 card shows the industry line, so the return signature gains an
-- `industry` column. Return-type changes are rejected by `create or
-- replace`, so DROP first (039 pattern). Body otherwise byte-identical
-- to 039's definition.
drop function if exists compat_projects_for_seeker(uuid, int);

create or replace function compat_projects_for_seeker(
  p_seeker_id uuid,
  p_limit     int default 30
)
returns table (
  project_id      uuid,
  title           text,
  vibe_blurb      text,
  industry        text,
  required_skills text[],
  roles_sought    text[],
  image_url       text,
  needed_by       date,
  owner_id        uuid,
  score           numeric(5,2),
  skill_match_pct numeric(5,2),
  vibe_similarity numeric(5,2)
)
language sql
stable
security definer
set search_path = public
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
      pr.industry,
      pr.required_skills,
      pr.roles_sought,
      pr.image_url,
      pr.needed_by,
      pr.owner_id,
      pr.created_at,
      case
        when array_length(pr.required_skills, 1) = 0 then 0
        else (
          select count(*)::numeric
          from   unnest(pr.required_skills) rs
          where  rs = any(seeker.skills)
        ) / array_length(pr.required_skills, 1)::numeric
      end                                        as skill_match_pct,
      case
        when pr.vibe_embedding is null or seeker.vibe_embedding is null then 0
        else greatest(0, 1 - (pr.vibe_embedding <=> seeker.vibe_embedding))
      end                                        as vibe_sim
    from projects pr, seeker
    where pr.active = true
      and pr.owner_id <> p_seeker_id
      -- Reach-outs stay excluded (a conversation exists); skips only cool the
      -- project down for 7 days, then it may resurface.
      and not exists (
        select 1 from matches m
        where m.seeker_id = p_seeker_id
          and m.project_id = pr.id
          and (
            m.outcome = 'applied'
            or (m.outcome = 'skipped' and m.created_at > now() - interval '7 days')
          )
      )
      -- Safety: drop projects whose owner blocked the seeker or is blocked by them.
      and not exists (
        select 1 from blocked_users b
        where (b.blocker_id = p_seeker_id and b.blocked_id = pr.owner_id)
           or (b.blocker_id = pr.owner_id and b.blocked_id = p_seeker_id)
      )
  )
  select
    id              as project_id,
    title,
    vibe_blurb,
    industry,
    required_skills,
    roles_sought,
    image_url,
    needed_by,
    owner_id,
    round((70 * skill_match_pct + 30 * vibe_sim)::numeric, 2) as score,
    round((skill_match_pct * 100)::numeric, 2)                as skill_match_pct,
    round((vibe_sim * 100)::numeric, 2)                       as vibe_similarity
  from scored
  order by score desc, created_at desc
  limit p_limit;
$$;

grant execute on function compat_projects_for_seeker(uuid, int) to authenticated;
