-- 031_safety.sql — UGC safety layer (App Store Guideline 1.2)
--
-- Adds block-user + report-content infrastructure:
--   • blocked_users        — bidirectional block relationships
--   • content_reports      — user reports, reviewed via the service role
--   • block/unblock/report RPCs
--   • block-filtering woven into the discovery RPCs and the inbox RPC so a
--     blocked user disappears from BOTH sides' feed and inbox
--   • a message-insert RLS guard so a blocked pair can never message (the real
--     enforcement — all four send paths insert directly into `messages`)

-- ─────────────────────────────────────────────────────────────
-- 1. Tables + RLS
-- ─────────────────────────────────────────────────────────────

create table if not exists blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
-- Reverse lookup ("who blocked me?") for the bidirectional filters below.
create index if not exists blocked_users_blocked_idx on blocked_users(blocked_id);

alter table blocked_users enable row level security;

drop policy if exists "blocked_users: own select" on blocked_users;
create policy "blocked_users: own select"
  on blocked_users for select to authenticated
  using (blocker_id = auth.uid());
drop policy if exists "blocked_users: own insert" on blocked_users;
create policy "blocked_users: own insert"
  on blocked_users for insert to authenticated
  with check (blocker_id = auth.uid());
drop policy if exists "blocked_users: own delete" on blocked_users;
create policy "blocked_users: own delete"
  on blocked_users for delete to authenticated
  using (blocker_id = auth.uid());

create table if not exists content_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  conversation_id  uuid references conversations(id) on delete set null,
  message_id       uuid references messages(id) on delete set null,
  reason           text not null,
  detail           text,
  -- pending → reviewed → actioned | dismissed. Triaged via the Supabase
  -- dashboard (service role) within 24h per Apple's UGC expectation.
  status           text not null default 'pending',
  created_at       timestamptz not null default now()
);
create index if not exists content_reports_status_idx on content_reports(status, created_at desc);

alter table content_reports enable row level security;

-- Reporters insert + read their OWN reports; review is service-role only
-- (no broad authenticated read of the report queue).
drop policy if exists "content_reports: own insert" on content_reports;
create policy "content_reports: own insert"
  on content_reports for insert to authenticated
  with check (reporter_id = auth.uid());
drop policy if exists "content_reports: own select" on content_reports;
create policy "content_reports: own select"
  on content_reports for select to authenticated
  using (reporter_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. Block / unblock / report RPCs
-- ─────────────────────────────────────────────────────────────

create or replace function block_user(p_blocked_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into blocked_users (blocker_id, blocked_id)
  values (auth.uid(), p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;
$$;

create or replace function unblock_user(p_blocked_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from blocked_users
  where blocker_id = auth.uid() and blocked_id = p_blocked_id;
$$;

create or replace function report_content(
  p_reported_user_id uuid,
  p_reason           text,
  p_conversation_id  uuid default null,
  p_message_id       uuid default null,
  p_detail           text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into content_reports
    (reporter_id, reported_user_id, conversation_id, message_id, reason, detail)
  values
    (auth.uid(), p_reported_user_id, p_conversation_id, p_message_id, p_reason, p_detail);
$$;

grant execute on function block_user(uuid)                        to authenticated;
grant execute on function unblock_user(uuid)                      to authenticated;
grant execute on function report_content(uuid, text, uuid, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Message-insert guard — a blocked pair can never message.
--    Recreates 003's "messages: participant insert" with a block check.
-- ─────────────────────────────────────────────────────────────

drop policy if exists "messages: participant insert" on messages;
create policy "messages: participant insert"
  on messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.owner_id = auth.uid() or c.seeker_id = auth.uid())
    )
    and not exists (
      select 1
      from conversations c
      join blocked_users b
        on (b.blocker_id = c.owner_id  and b.blocked_id = c.seeker_id)
        or (b.blocker_id = c.seeker_id and b.blocked_id = c.owner_id)
      where c.id = conversation_id
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. Block-filter the discovery RPCs (bidirectional).
--    Recreated verbatim from 001_matching.sql + a blocked_users guard.
-- ─────────────────────────────────────────────────────────────

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

-- Recreated from 022_project_needed_by.sql (the latest definition — carries
-- roles_sought/image_url/needed_by) + the block filter. DROP first because the
-- return signature can't be changed in place.
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
    campus_id,
    owner_id,
    round((70 * skill_match_pct + 30 * vibe_sim)::numeric, 2) as score,
    round((skill_match_pct * 100)::numeric, 2)                as skill_match_pct,
    round((vibe_sim * 100)::numeric, 2)                       as vibe_similarity
  from scored
  order by score desc, created_at desc
  limit p_limit;
$$;

grant execute on function compat_for_project(uuid, int)          to authenticated;
grant execute on function compat_projects_for_seeker(uuid, int)  to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. Block-filter the inbox RPC (bidirectional).
--    Recreated verbatim from 020_repair_inbox_pinning.sql + a block guard.
--    DROP first — the return signature can't be changed in place.
-- ─────────────────────────────────────────────────────────────

drop function if exists get_inbox();
create or replace function get_inbox()
returns table (
  conversation_id              uuid,
  project_id                   uuid,
  project_title                text,
  partner_id                   uuid,
  partner_name                 text,
  partner_photo_url            text,
  last_message_at              timestamptz,
  last_message_body            text,
  last_message_attachment_url  text,
  last_message_sender_id       uuid,
  last_message_deleted         boolean,
  unread_count                 bigint,
  status                       text,
  pass_reason                  text,
  hired_at                     timestamptz,
  hired_proposed_by            uuid,
  auto_decline_at              timestamptz,
  is_pinned                    boolean,
  pinned_at                    timestamptz,
  is_muted                     boolean,
  is_archived                  boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform sweep_auto_declined_for_user();

  return query
  with me as (select auth.uid() as id)
  select
    c.id,
    c.project_id,
    p.title,
    case when c.owner_id = (select id from me) then c.seeker_id else c.owner_id end,
    partner.name,
    partner.photo_url,
    c.last_message_at,
    last_msg.body,
    last_msg.attachment_url,
    last_msg.sender_id,
    (last_msg.deleted_at is not null),
    (
      select count(*) from messages m2
      where m2.conversation_id = c.id
        and m2.sender_id <> (select id from me)
        and m2.created_at > coalesce(r.last_read_at, '1970-01-01'::timestamptz)
        and m2.deleted_at is null
        and m2.kind = 'user'
    )::bigint,
    c.status,
    c.pass_reason,
    c.hired_at,
    c.hired_proposed_by,
    c.auto_decline_at,
    c.is_pinned,
    c.pinned_at,
    ((select id from me) = any(c.muted_by)),
    ((select id from me) = any(c.archived_by))
  from conversations c
  join projects p on p.id = c.project_id
  join profiles partner on partner.id =
    (case when c.owner_id = (select id from me) then c.seeker_id else c.owner_id end)
  left join lateral (
    select m.body, m.attachment_url, m.sender_id, m.deleted_at
    from messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) last_msg on true
  left join conversation_reads r
    on r.conversation_id = c.id and r.user_id = (select id from me)
  where (c.owner_id = (select id from me) or c.seeker_id = (select id from me))
    -- Safety: hide conversations with anyone in a block relationship with me.
    and not exists (
      select 1 from blocked_users b
      where (b.blocker_id = (select id from me)
             and b.blocked_id = case when c.owner_id = (select id from me) then c.seeker_id else c.owner_id end)
         or (b.blocked_id = (select id from me)
             and b.blocker_id = case when c.owner_id = (select id from me) then c.seeker_id else c.owner_id end)
    )
  order by
    case when c.status = 'hired_pending' then 0 else 1 end,
    case when c.is_pinned                  then 0 else 1 end,
    c.pinned_at desc nulls last,
    c.last_message_at desc;
end;
$$;

grant execute on function get_inbox() to authenticated;
