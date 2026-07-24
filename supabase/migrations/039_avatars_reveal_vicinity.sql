-- ============================================================
-- 039_avatars_reveal_vicinity.sql · Monster avatars + photo-as-
-- reveal + vicinity preference + professors/campus removal.
-- Spec: docs/superpowers/specs/2026-07-23-avatars-projects-vicinity-design.md
-- ============================================================

-- ── 1. avatar_id — picked monster mark ──────────────────────
alter table profiles
  add column if not exists avatar_id text not null default 'monster-01'
  check (avatar_id ~ '^monster-(0[1-9]|1[0-2])$');

-- Deterministic backfill so existing users don't all share monster-01.
update profiles
   set avatar_id = 'monster-' || lpad(((('x' || substr(md5(id::text), 1, 8))::bit(32)::int & 2147483647) % 12 + 1)::text, 2, '0')
 where avatar_id = 'monster-01';

-- ── 2. open_to_nearby — vicinity preference ─────────────────
-- Null = unanswered (onboarding gates on a choice).
alter table profiles add column if not exists open_to_nearby boolean;

-- ── 3. photo reveal — server-side gate ──────────────────────
-- A peer's photo is visible iff (a) it's your own, or (b) a
-- conversation exists between you where BOTH parties have sent a
-- user message (the recipient chose to respond) and the thread is
-- not passed/auto_declined. Same mutuality derivation as 038.
create or replace function fetch_peer_photos(peer_ids uuid[])
returns table (user_id uuid, photo_url text)
language sql security definer set search_path = public as $$
  select p.id, p.photo_url
  from profiles p
  where p.id = any(peer_ids)
    and p.photo_url is not null
    and (
      p.id = auth.uid()
      or exists (
        select 1
        from conversations c
        where c.status not in ('passed', 'auto_declined')
          and ((c.owner_id = auth.uid() and c.seeker_id = p.id)
            or (c.seeker_id = auth.uid() and c.owner_id = p.id))
          and exists (select 1 from messages m
                       where m.conversation_id = c.id
                         and m.sender_id = auth.uid() and m.deleted_at is null)
          and exists (select 1 from messages m
                       where m.conversation_id = c.id
                         and m.sender_id = p.id and m.deleted_at is null)
      )
    )
$$;
revoke all on function fetch_peer_photos(uuid[]) from public;
grant execute on function fetch_peer_photos(uuid[]) to authenticated;

-- Hardening: fetch_peer_photos is the ONLY read path for photo_url.
--
-- WHY a bare `revoke select (photo_url)` is a NO-OP: Postgres UNIONs
-- table-level and column-level privileges. Supabase's default grants hand
-- `authenticated` (and `anon`) table-level SELECT on every public table, so
-- a column-level revoke leaves the table-level SELECT intact and photo_url
-- stays readable via a direct PostgREST select. The only way to withhold a
-- single column is to drop the table-level SELECT entirely and re-grant it
-- column-by-column for every column EXCEPT photo_url.
--
-- COLUMN LIST is the authoritative post-039 set. profiles' base table DDL is
-- provisioned outside these migrations (Supabase-managed), so the list is
-- derived from: seed inserts (supabase/seed.sql + supabase/seeds/*), every
-- `alter table profiles add column` migration (001 vibe_embedding /
-- reliability_score / last_meaningful_action_at, 005 response_rate /
-- avg_response_minutes, 015 last_active_at, 025 github_url / linkedin_url /
-- portfolio_url / resume_url, 026 is_seed, 034 phone, this file's avatar_id /
-- open_to_nearby), and cross-checked against every client `.from('profiles')
-- .select(...)` in the app — every selected column is present below.
-- demographic + campus_id are dropped in section 4, so they are absent.
--
-- SECURITY DEFINER functions (fetch_peer_photos above, get_inbox, the compat_*
-- RPCs) execute with owner privileges and BYPASS these column grants — they
-- still read photo_url and every other column freely. service_role likewise
-- has bypassrls + full grants and is unaffected. No trigger reads photo_url
-- through the authenticated/anon roles, so nothing else regresses.
revoke select on profiles from authenticated;
grant select (
  id, edu_email, name, role,
  vibe_blurb, skills, vibe_embedding,
  avatar_id, open_to_nearby,
  reliability_score, response_rate, avg_response_minutes,
  last_meaningful_action_at, last_active_at,
  github_url, linkedin_url, portfolio_url, resume_url,
  phone, is_seed, updated_at
) on profiles to authenticated;

-- anon: Supabase's default grants also give `anon` table-level SELECT on
-- profiles. anon is already denied every profiles row by RLS (012 created the
-- sole permissive SELECT policy `to authenticated`; there is NO `to anon`
-- policy), so anon reads nothing today regardless. We apply the same
-- revoke + column re-grant anyway as defense-in-depth: it guarantees the
-- photo_url lockdown holds even if an anon-scoped RLS policy is ever added.
revoke select on profiles from anon;
grant select (
  id, edu_email, name, role,
  vibe_blurb, skills, vibe_embedding,
  avatar_id, open_to_nearby,
  reliability_score, response_rate, avg_response_minutes,
  last_meaningful_action_at, last_active_at,
  github_url, linkedin_url, portfolio_url, resume_url,
  phone, is_seed, updated_at
) on profiles to anon;

-- ── 4. professors + campus removal ──────────────────────────
-- ORDERING: compat_projects_for_seeker's body selects projects.campus_id
-- and its RETURN TABLE type declares a campus_id column. `language sql`
-- function BODIES are not tracked as pg_depend dependencies, so dropping
-- the column would not itself be refused — BUT the old function would then
-- error at call time (missing column). And because the new signature drops
-- campus_id from `returns table (...)`, `create or replace` is rejected
-- (return type may not change). So we DROP the function first, then drop
-- the columns, then CREATE it fresh below (section 5). Order:
--   drop function → drop columns → create function.
drop function if exists compat_projects_for_seeker(uuid, int);

alter table profiles drop column if exists demographic;
alter table profiles drop column if exists campus_id;
alter table projects drop column if exists campus_id;

-- ── 5. RPC redefinition without campus_id ───────────────────
-- Body copied verbatim from 035_pass_cooldown.sql (latest seeker-deck
-- definition); only campus_id is removed from the `returns table (...)`
-- signature and from both select lists. Everything else is byte-identical.
--
-- NOTE: the owner-deck RPC compat_for_project (latest def: 037) never
-- referenced campus_id, so it needs no redefinition and is left untouched.
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
