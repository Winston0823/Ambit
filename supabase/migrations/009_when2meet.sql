-- ============================================================
-- 009_when2meet.sql  ·  When-to-meet availability polls
-- ============================================================
-- Layered on top of 008_scheduling: a poll is a wider availability
-- search across a date range; once both sides have marked their slots
-- and they overlap, either side "locks in" a slot which becomes a
-- normal scheduling_requests row in the 'accepted' state. From there
-- the existing device-calendar add path takes over.
-- ============================================================

-- ── 1. availability_polls ───────────────────────────────────
create table if not exists availability_polls (
  id                              uuid primary key default gen_random_uuid(),
  conversation_id                 uuid not null references conversations(id) on delete cascade,
  proposer_id                     uuid not null references auth.users(id) on delete cascade,
  recipient_id                    uuid not null references auth.users(id) on delete cascade,
  title                           text not null default 'When can we meet?',
  duration_min                    int  not null default 30 check (duration_min in (15, 30, 45, 60)),
  -- Window over which slots can be picked. day_start_hour <= day_end_hour;
  -- end_date is inclusive (so a Mon-Fri poll has end_date = Fri).
  start_date                      date not null,
  end_date                        date not null,
  day_start_hour                  int  not null default 9  check (day_start_hour between 0 and 23),
  day_end_hour                    int  not null default 21 check (day_end_hour between 1 and 24),
  /// IANA timezone the poll's hours are anchored to. The proposer's tz
  /// at poll creation — both sides see slot labels in this tz so the
  /// grid columns line up regardless of where the recipient lives.
  tz                              text not null,
  status                          text not null default 'open'
    check (status in ('open', 'closed', 'cancelled')),
  /// Set once finalize_availability_poll fires — points at the
  /// scheduling_requests row created in the 'accepted' state.
  settled_scheduling_request_id   uuid references scheduling_requests(id) on delete set null,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  check (proposer_id <> recipient_id),
  check (end_date >= start_date),
  check (end_date - start_date <= 5),  -- max 5-day window
  check (day_end_hour > day_start_hour)
);

create index if not exists idx_availability_polls_conversation
  on availability_polls (conversation_id);
create index if not exists idx_availability_polls_recipient_open
  on availability_polls (recipient_id, status)
  where status = 'open';

-- ── 2. availability_responses ───────────────────────────────
-- One row per (poll, user). selected_slots is a jsonb array of
-- {start, end} ISO strings. Recipient may have zero rows if they
-- haven't engaged yet; the client treats missing as empty.
create table if not exists availability_responses (
  poll_id        uuid references availability_polls(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete cascade,
  selected_slots jsonb not null default '[]',
  updated_at     timestamptz not null default now(),
  primary key (poll_id, user_id),
  check (jsonb_typeof(selected_slots) = 'array')
);

-- ── 3. messages.availability_poll_id ───────────────────────
alter table messages
  add column if not exists availability_poll_id uuid
    references availability_polls(id) on delete set null;

create index if not exists idx_messages_availability_poll
  on messages (availability_poll_id)
  where availability_poll_id is not null;

-- ── 4. RLS ──────────────────────────────────────────────────
alter table availability_polls     enable row level security;
alter table availability_responses enable row level security;

create policy "polls: participant read"
  on availability_polls for select to authenticated
  using (proposer_id = auth.uid() or recipient_id = auth.uid());

create policy "polls: proposer insert"
  on availability_polls for insert to authenticated
  with check (
    proposer_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.owner_id = auth.uid() or c.seeker_id = auth.uid())
    )
  );

create policy "polls: participant update"
  on availability_polls for update to authenticated
  using (proposer_id = auth.uid() or recipient_id = auth.uid())
  with check (proposer_id = auth.uid() or recipient_id = auth.uid());

-- Each user manages their own response row.
create policy "responses: own all"
  on availability_responses for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Read the partner's response too (so the grid can overlay their slots).
-- Authorized via poll participation, not response ownership.
create policy "responses: participant read"
  on availability_responses for select to authenticated
  using (
    exists (
      select 1 from availability_polls p
      where p.id = poll_id
        and (p.proposer_id = auth.uid() or p.recipient_id = auth.uid())
    )
  );

-- ── 5. create_availability_poll RPC ─────────────────────────
create or replace function create_availability_poll(
  p_conversation_id uuid,
  p_title           text,
  p_duration_min    int,
  p_start_date      date,
  p_end_date        date,
  p_day_start_hour  int,
  p_day_end_hour    int,
  p_tz              text,
  p_proposer_slots  jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller     uuid := auth.uid();
  v_other_id   uuid;
  v_poll_id    uuid;
  v_msg_body   text;
  v_days       int;
begin
  if v_caller is null then raise exception 'not authenticated'; end if;

  select case when c.owner_id = v_caller then c.seeker_id else c.owner_id end
    into v_other_id
    from conversations c
   where c.id = p_conversation_id
     and (c.owner_id = v_caller or c.seeker_id = v_caller);

  if v_other_id is null then raise exception 'not a participant'; end if;

  insert into availability_polls (
    conversation_id, proposer_id, recipient_id,
    title, duration_min, start_date, end_date,
    day_start_hour, day_end_hour, tz
  ) values (
    p_conversation_id, v_caller, v_other_id,
    coalesce(nullif(trim(p_title), ''), 'When can we meet?'),
    coalesce(p_duration_min, 30),
    p_start_date, p_end_date,
    coalesce(p_day_start_hour, 9),
    coalesce(p_day_end_hour, 21),
    coalesce(nullif(trim(p_tz), ''), 'UTC')
  )
  returning id into v_poll_id;

  -- Seed the proposer's response with their initial selections.
  insert into availability_responses (poll_id, user_id, selected_slots)
  values (v_poll_id, v_caller, coalesce(p_proposer_slots, '[]'::jsonb));

  v_days := (p_end_date - p_start_date) + 1;
  v_msg_body := '📅 Availability poll · ' || v_days || ' day' ||
    (case when v_days = 1 then '' else 's' end);

  insert into messages (conversation_id, sender_id, body, availability_poll_id)
  values (p_conversation_id, v_caller, v_msg_body, v_poll_id);

  return v_poll_id;
end;
$$;

-- ── 6. set_availability_response RPC ────────────────────────
-- Upsert helper so the client doesn't manage the on-conflict shape.
create or replace function set_availability_response(
  p_poll_id        uuid,
  p_selected_slots jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_poll   availability_polls%rowtype;
begin
  if v_caller is null then raise exception 'not authenticated'; end if;
  select * into v_poll from availability_polls where id = p_poll_id;
  if not found then raise exception 'poll not found'; end if;
  if v_poll.status <> 'open' then raise exception 'poll already %', v_poll.status; end if;
  if v_caller <> v_poll.proposer_id and v_caller <> v_poll.recipient_id then
    raise exception 'not a participant';
  end if;

  insert into availability_responses (poll_id, user_id, selected_slots, updated_at)
  values (p_poll_id, v_caller, coalesce(p_selected_slots, '[]'::jsonb), now())
  on conflict (poll_id, user_id) do update
    set selected_slots = excluded.selected_slots,
        updated_at     = now();
end;
$$;

-- ── 7. finalize_availability_poll RPC ───────────────────────
-- Either participant can lock in a chosen slot. Closes the poll and
-- creates a scheduling_requests row in 'accepted' state, so the
-- existing device-calendar add path (in the SchedulingBubble) kicks
-- in for both sides.
create or replace function finalize_availability_poll(
  p_poll_id    uuid,
  p_slot_start timestamptz,
  p_slot_end   timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_poll     availability_polls%rowtype;
  v_req_id   uuid;
  v_slot     jsonb;
  v_msg_body text;
begin
  if v_caller is null then raise exception 'not authenticated'; end if;
  select * into v_poll from availability_polls where id = p_poll_id;
  if not found then raise exception 'poll not found'; end if;
  if v_poll.status <> 'open' then raise exception 'poll already %', v_poll.status; end if;
  if v_caller <> v_poll.proposer_id and v_caller <> v_poll.recipient_id then
    raise exception 'not a participant';
  end if;

  v_slot := jsonb_build_object(
    'start', to_char(p_slot_start at time zone v_poll.tz, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'end',   to_char(p_slot_end   at time zone v_poll.tz, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'tz',    v_poll.tz
  );

  -- Mirror the slot back into ISO-with-offset for downstream tooling.
  v_slot := jsonb_set(v_slot, '{start}', to_jsonb(p_slot_start::text));
  v_slot := jsonb_set(v_slot, '{end}',   to_jsonb(p_slot_end::text));

  insert into scheduling_requests (
    conversation_id, proposer_id, recipient_id,
    status, proposed_slots, accepted_slot,
    title, duration_min
  ) values (
    v_poll.conversation_id,
    v_poll.proposer_id,
    v_poll.recipient_id,
    'accepted',
    jsonb_build_array(v_slot),
    v_slot,
    v_poll.title,
    v_poll.duration_min
  )
  returning id into v_req_id;

  update availability_polls
     set status                          = 'closed',
         settled_scheduling_request_id   = v_req_id,
         updated_at                      = now()
   where id = p_poll_id;

  v_msg_body := '📅 Locked in a time';
  insert into messages (conversation_id, sender_id, body, scheduling_request_id)
  values (v_poll.conversation_id, v_caller, v_msg_body, v_req_id);

  return v_req_id;
end;
$$;

-- ── 8. Realtime ─────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table availability_polls;
    alter publication supabase_realtime add table availability_responses;
  end if;
exception
  when duplicate_object then null;
end $$;
