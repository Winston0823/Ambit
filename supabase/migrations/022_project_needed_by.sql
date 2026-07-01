-- ============================================================
-- 022_project_needed_by.sql
-- Adds an optional deadline to projects ("needs someone by ___").
-- Surfaced on the discovery card's top-right badge as an urgency
-- signal, e.g. "Needs Frontend · by Apr 30". Optional — null = no
-- deadline shown.
-- ============================================================

-- ── 1. Schema addition ──────────────────────────────────────
alter table projects
  add column if not exists needed_by date;

-- ── 2. Surface needed_by through compat_projects_for_seeker ──
-- The seeker deck reads from this RPC, so a new column must be added
-- to its returns table (and selects). This redefinition carries both
-- image_url (from 021) and needed_by. Scoring logic is unchanged —
-- both are display metadata only.
drop function if exists compat_projects_for_seeker(uuid, int);

create or replace function compat_projects_for_seeker(
  p_seeker_id uuid,
  p_limit     int default 30
)
returns table (
  project_id      uuid,
  title           text,
  vibe_blurb      text,
  required_skills text[],
  roles_sought    text[],
  image_url       text,
  needed_by       date,
  campus_id       text,
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
      pr.required_skills,
      pr.roles_sought,
      pr.image_url,
      pr.needed_by,
      pr.campus_id,
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
    roles_sought,
    image_url,
    needed_by,
    campus_id,
    owner_id,
    round((70 * skill_match_pct + 30 * vibe_sim)::numeric, 2) as score,
    round((skill_match_pct * 100)::numeric, 2)                as skill_match_pct,
    round((vibe_sim * 100)::numeric, 2)                       as vibe_similarity
  from scored
  order by score desc, created_at desc
  limit p_limit;
$$;

grant execute on function compat_projects_for_seeker(uuid, int) to authenticated;
