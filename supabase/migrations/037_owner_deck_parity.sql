-- 037_owner_deck_parity.sql — give the OWNER deck the same matches exclusion
-- the SEEKER deck got in 035.
--
-- The seeker deck (compat_projects_for_seeker) excludes reach-outs forever and
-- skips for a 7-day cooldown. The owner deck (compat_for_project) had NO matches
-- exclusion at all, so a seeker an owner passed on (or already reached out to)
-- kept resurfacing in the owner's deck. Owner decisions are recorded as matches
-- rows keyed (seeker_id = the seeker, project_id = the owner's project):
-- 'skipped' for a pass, 'applied' for a reach-out.
--
-- Body copied verbatim from 031_safety.sql (block filter + `set search_path`);
-- only the matches exclusion is added. Same return signature, so `create or
-- replace` suffices (no drop needed).

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
set search_path = public
as $$
  with proj as (
    select required_skills, vibe_embedding
    from   projects
    where  id = p_project_id and active = true
  ),
  scored as (
    select
      p.id                                                             as seeker_id,
      case
        when array_length(proj.required_skills, 1) = 0 then 0
        else (
          select count(*)::numeric
          from   unnest(proj.required_skills) rs
          where  rs = any(p.skills)
        ) / array_length(proj.required_skills, 1)::numeric
      end                                                              as skill_match_pct,
      case
        when proj.vibe_embedding is null or p.vibe_embedding is null then 0
        else greatest(0, 1 - (proj.vibe_embedding <=> p.vibe_embedding))
      end                                                              as vibe_sim,
      p.reliability_score                                              as reliability,
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
      and exists (
        select 1 from unnest(proj.required_skills) rs
        where rs = any(p.skills)
      )
      -- Reach-outs stay excluded (a conversation exists); skips only cool the
      -- seeker down for 7 days, then they may resurface. Mirrors 035's seeker
      -- deck semantics — matches rows are keyed (seeker = p.id, project =
      -- p_project_id).
      and not exists (
        select 1 from matches m
        where m.seeker_id = p.id
          and m.project_id = p_project_id
          and (
            m.outcome = 'applied'
            or (m.outcome = 'skipped' and m.created_at > now() - interval '7 days')
          )
      )
      -- Safety: drop seekers who blocked the project owner or are blocked by them.
      and not exists (
        select 1 from blocked_users b, projects pj
        where pj.id = p_project_id
          and ( (b.blocker_id = pj.owner_id and b.blocked_id = p.id)
             or (b.blocker_id = p.id        and b.blocked_id = pj.owner_id) )
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

grant execute on function compat_for_project(uuid, int) to authenticated;
