-- ============================================================
-- 004_closure_loop.sql  ·  Closure-loop additions on top of the
-- messaging + matching system: conversation status state machine,
-- pass-with-reason, hire confirmation, 72h lazy auto-decline,
-- response-rate metrics. Recreates get_inbox + compat_projects_
-- for_seeker to surface the new fields and deprioritize founders
-- with low response rates.
--
-- Run via supabase db push after 003_messaging.sql.
-- ============================================================

-- ── 1. conversations: status state machine + auto-decline ───
-- status flows:
--   active        → default; either party can pass / propose hire / send messages
--   passed        → recipient passed with optional reason; composer disabled
--   hired_pending → one party proposed a hire; waiting on the other to confirm
--   hired         → both parties have confirmed; composer disabled
--   auto_declined → 72h elapsed with no action from the recipient; composer disabled
alter table conversations
  add column if not exists status text
    default 'active'
    check (status in ('active','passed','hired_pending','hired','auto_declined')),
  add column if not exists pass_reason text,
  add column if not exists passed_by uuid references auth.users(id),
  add column if not exists hired_proposed_by uuid references auth.users(id),
  add column if not exists hired_at timestamptz;

-- auto_decline_at = created_at + 72h. We use a regular column + a
-- BEFORE INSERT trigger instead of a STORED generated column because
-- Postgres considers `timestamptz + interval` non-IMMUTABLE (an
-- interval with units like 'month' or 'day' could shift across DST),
-- even though 'hours' specifically is safe. STORED generated columns
-- require IMMUTABLE expressions; the check fails on the whole
-- expression. Same semantic effect via the trigger.
alter table conversations
  add column if not exists auto_decline_at timestamptz;

-- Backfill rows that existed before this migration. Idempotent — only
-- touches rows whose auto_decline_at is still null.
update conversations
   set auto_decline_at = created_at + interval '72 hours'
 where auto_decline_at is null;

create or replace function trg_set_auto_decline_at()
returns trigger language plpgsql as $$
begin
  new.auto_decline_at := new.created_at + interval '72 hours';
  return new;
end;
$$;

drop trigger if exists set_auto_decline_at on conversations;
create trigger set_auto_decline_at
  before insert on conversations
  for each row execute function trg_set_auto_decline_at();

create index if not exists idx_conversations_status_decline
  on conversations (status, auto_decline_at)
  where status = 'active';

-- ── 2. messages: kind column so system messages render differently ──
-- 'user' (default) = a normal message from a participant.
-- The rest are inserted by closure-loop RPCs; the UI shows them as a
-- centered banner, not a speech bubble. sender_id still references a
-- real user (the actioner) so RLS and FK semantics stay clean.
alter table messages
  add column if not exists kind text
    default 'user'
    check (kind in ('user','system_pass','system_hire_proposed','system_hired','system_auto_declined'));

-- ── 3. profiles: response-rate cache ───────────────────────────
-- Recomputed by triggers on messages + conversation_reads. NULL until
-- the user has had at least one reach-out aged past the 72h window.
alter table profiles
  add column if not exists response_rate numeric(3,2),
  add column if not exists avg_response_minutes int;

-- ── 4. pass_conversation RPC ──────────────────────────────────
-- Recipient passes on an active conversation with a reason. Inserts a
-- system_pass message so the candidate sees the reason. Idempotent: if
-- already passed, no-op.
create or replace function pass_conversation(
  p_conversation_id uuid,
  p_reason          text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller     uuid := auth.uid();
  v_owner_id   uuid;
  v_seeker_id  uuid;
  v_status     text;
  v_reason     text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_caller is null then raise exception 'not authenticated'; end if;

  select owner_id, seeker_id, status
    into v_owner_id, v_seeker_id, v_status
    from conversations
   where id = p_conversation_id
   for update;

  if v_owner_id is null then raise exception 'conversation not found'; end if;
  if v_caller <> v_owner_id and v_caller <> v_seeker_id then
    raise exception 'not a participant';
  end if;
  if v_status <> 'active' then
    return; -- idempotent: already passed/hired/declined
  end if;

  update conversations
     set status      = 'passed',
         pass_reason = v_reason,
         passed_by   = v_caller
   where id = p_conversation_id;

  insert into messages (conversation_id, sender_id, body, kind)
  values (
    p_conversation_id,
    v_caller,
    coalesce(v_reason, 'Passed without a reason.'),
    'system_pass'
  );
end;
$$;

-- ── 5. propose_hire RPC ───────────────────────────────────────
-- Either participant proposes marking the conversation as hired. The
-- other side must call confirm_hire to finalize. Idempotent if the
-- caller already proposed; raises if status is already hired/closed.
create or replace function propose_hire(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller     uuid := auth.uid();
  v_owner_id   uuid;
  v_seeker_id  uuid;
  v_status     text;
  v_proposer   uuid;
begin
  if v_caller is null then raise exception 'not authenticated'; end if;

  select owner_id, seeker_id, status, hired_proposed_by
    into v_owner_id, v_seeker_id, v_status, v_proposer
    from conversations
   where id = p_conversation_id
   for update;

  if v_owner_id is null then raise exception 'conversation not found'; end if;
  if v_caller <> v_owner_id and v_caller <> v_seeker_id then
    raise exception 'not a participant';
  end if;
  if v_status in ('hired','passed','auto_declined') then
    raise exception 'conversation is already closed';
  end if;
  -- Re-proposing while already pending is a no-op
  if v_status = 'hired_pending' and v_proposer = v_caller then
    return;
  end if;

  update conversations
     set status            = 'hired_pending',
         hired_proposed_by = v_caller
   where id = p_conversation_id;

  insert into messages (conversation_id, sender_id, body, kind)
  values (
    p_conversation_id,
    v_caller,
    'Proposed marking this conversation as Hired. Confirm?',
    'system_hire_proposed'
  );
end;
$$;

-- ── 6. confirm_hire RPC ───────────────────────────────────────
-- The OTHER participant (not the proposer) confirms. Sets status to
-- 'hired', records hired_at, inserts the celebration system message.
create or replace function confirm_hire(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller     uuid := auth.uid();
  v_owner_id   uuid;
  v_seeker_id  uuid;
  v_status     text;
  v_proposer   uuid;
begin
  if v_caller is null then raise exception 'not authenticated'; end if;

  select owner_id, seeker_id, status, hired_proposed_by
    into v_owner_id, v_seeker_id, v_status, v_proposer
    from conversations
   where id = p_conversation_id
   for update;

  if v_owner_id is null then raise exception 'conversation not found'; end if;
  if v_caller <> v_owner_id and v_caller <> v_seeker_id then
    raise exception 'not a participant';
  end if;
  if v_status <> 'hired_pending' then
    raise exception 'no pending hire to confirm';
  end if;
  if v_proposer = v_caller then
    raise exception 'the other party must confirm';
  end if;

  update conversations
     set status   = 'hired',
         hired_at = now()
   where id = p_conversation_id;

  insert into messages (conversation_id, sender_id, body, kind)
  values (
    p_conversation_id,
    v_caller,
    'Confirmed. You hired each other.',
    'system_hired'
  );
end;
$$;

-- ── 7. sweep_auto_declined_for_user RPC ────────────────────────
-- Lazy 72h evaluation. Called from get_inbox at the top of each open.
-- Finds active conversations addressed to the calling user where:
--   - auto_decline_at < now()
--   - the recipient (caller, when they're the owner) hasn't read AND
--     hasn't sent any message
-- and marks them auto_declined + drops a gentle system message. Returns
-- the count for diagnostics.
create or replace function sweep_auto_declined_for_user()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_count  int := 0;
  v_conv   record;
begin
  if v_caller is null then return 0; end if;

  for v_conv in
    select c.id, c.owner_id
      from conversations c
      left join conversation_reads cr
        on cr.conversation_id = c.id and cr.user_id = c.owner_id
     where c.status = 'active'
       and c.auto_decline_at < now()
       and c.owner_id = v_caller
       and (cr.last_read_at is null or cr.last_read_at < c.created_at)
       and not exists (
         select 1 from messages m
         where m.conversation_id = c.id
           and m.sender_id = c.owner_id
           and m.kind = 'user'
       )
  loop
    update conversations
       set status = 'auto_declined'
     where id = v_conv.id;

    insert into messages (conversation_id, sender_id, body, kind)
    values (
      v_conv.id,
      v_conv.owner_id,
      'Reviewing other candidates right now.',
      'system_auto_declined'
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ── 8. recompute_response_metrics RPC ──────────────────────────
-- For a given user, compute the % of conversations addressed to them
-- (where they're the owner_id) over the last 90 days that they acted
-- on within 72h (read OR sent a message). Also computes avg response
-- time in minutes for acted-upon conversations. Caches both on profiles.
create or replace function recompute_response_metrics(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total      int;
  v_responded  int;
  v_avg_min    numeric;
begin
  with eligible as (
    select c.id, c.created_at
      from conversations c
     where c.owner_id = p_user_id
       and c.created_at > now() - interval '90 days'
       and c.created_at < now() - interval '72 hours'
  ),
  response_time as (
    select
      e.id,
      least(
        (select min(cr.last_read_at) from conversation_reads cr
          where cr.conversation_id = e.id and cr.user_id = p_user_id),
        (select min(m.created_at) from messages m
          where m.conversation_id = e.id and m.sender_id = p_user_id and m.kind = 'user')
      ) as first_action_at,
      e.created_at
    from eligible e
  ),
  scored as (
    select
      count(*) filter (where first_action_at is not null
                       and first_action_at <= created_at + interval '72 hours') as responded,
      count(*) as total,
      avg(extract(epoch from (first_action_at - created_at)) / 60)
        filter (where first_action_at is not null
                  and first_action_at <= created_at + interval '72 hours') as avg_min
    from response_time
  )
  select responded, total, avg_min
    into v_responded, v_total, v_avg_min
    from scored;

  if v_total is null or v_total = 0 then
    update profiles
       set response_rate         = null,
           avg_response_minutes  = null
     where id = p_user_id;
  else
    update profiles
       set response_rate         = round((v_responded::numeric / v_total::numeric), 2),
           avg_response_minutes  = round(coalesce(v_avg_min, 0))::int
     where id = p_user_id;
  end if;
end;
$$;

-- ── 9. Triggers wiring metrics to events ──────────────────────
create or replace function trg_recompute_on_message()
returns trigger language plpgsql as $$
declare
  v_owner uuid;
begin
  if new.kind <> 'user' then return new; end if;
  select owner_id into v_owner from conversations where id = new.conversation_id;
  if v_owner is not null and new.sender_id = v_owner then
    perform recompute_response_metrics(v_owner);
  end if;
  return new;
end;
$$;

drop trigger if exists recompute_metrics_on_owner_message on messages;
create trigger recompute_metrics_on_owner_message
  after insert on messages
  for each row execute function trg_recompute_on_message();

create or replace function trg_recompute_on_read()
returns trigger language plpgsql as $$
begin
  perform recompute_response_metrics(new.user_id);
  return new;
end;
$$;

drop trigger if exists recompute_metrics_on_read on conversation_reads;
create trigger recompute_metrics_on_read
  after insert or update on conversation_reads
  for each row execute function trg_recompute_on_read();

-- ── 10. get_inbox: include closure-loop fields + auto-sweep ───
-- Recreates the function from 003_messaging.sql. New columns at the
-- end so client TypeScript types are append-only. Calls the sweep up
-- front so any conversation just hitting 72h is settled before this
-- caller sees the inbox.
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
  auto_decline_at              timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Lazy sweep: any conversations addressed to the caller that hit 72h
  -- without action are auto-declined right here.
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
    c.auto_decline_at
  from conversations c
  join projects p on p.id = c.project_id
  join profiles partner on partner.id =
    (case when c.owner_id = (select id from me) then c.seeker_id else c.owner_id end)
  left join lateral (
    select body, attachment_url, sender_id, deleted_at
    from messages
    where conversation_id = c.id
    order by created_at desc
    limit 1
  ) last_msg on true
  left join conversation_reads r
    on r.conversation_id = c.id and r.user_id = (select id from me)
  where c.owner_id = (select id from me) or c.seeker_id = (select id from me)
  order by
    case when c.status = 'hired_pending' then 0 else 1 end,
    c.last_message_at desc;
end;
$$;

-- ── 11. compat_projects_for_seeker: deprioritize low responders ──
-- Recreates the function from 001_matching.sql with a response_rate
-- multiplier. Owners with response_rate < 0.50 get score × 0.7.
drop function if exists compat_projects_for_seeker(uuid, int);
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
      coalesce(owner.response_rate, 1.0)                              as owner_rr,
      case
        when array_length(pr.required_skills, 1) = 0 then 0
        else (
          select count(*)::numeric
          from   unnest(pr.required_skills) rs
          where  rs = any(seeker.skills)
        ) / array_length(pr.required_skills, 1)::numeric
      end                                                              as skill_match_pct,
      case
        when pr.vibe_embedding is null or seeker.vibe_embedding is null then 0
        else greatest(0, 1 - (pr.vibe_embedding <=> seeker.vibe_embedding))
      end                                                              as vibe_sim
    from projects pr
    join profiles owner on owner.id = pr.owner_id
    cross join seeker
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
    campus_id,
    owner_id,
    -- Apply response-rate deprioritization (×0.7 for <50% responders)
    round(((
      70 * skill_match_pct
      + 30 * vibe_sim
    ) * case when owner_rr < 0.5 then 0.7 else 1.0 end)::numeric, 2) as score,
    round((skill_match_pct * 100)::numeric, 2) as skill_match_pct,
    round((vibe_sim * 100)::numeric, 2)        as vibe_similarity
  from scored
  order by score desc, created_at desc
  limit p_limit;
$$;

-- ── 12. RLS: existing conversations / messages policies still apply.
-- The pass/hire/confirm RPCs are security definer so they can update
-- status server-side without the client needing UPDATE on conversations.
