-- ============================================================
-- 004_scheduling.sql  ·  Device-native calendar scheduling through chats
-- ============================================================
-- Wires:
--   1. scheduling_requests   — proposed/accepted/declined meeting requests
--   2. messages.scheduling_request_id — links a chat message to its request
--   3. propose_meeting / respond_to_meeting RPCs
--   4. Realtime publication for live status updates
-- Calendar event creation lives entirely client-side via expo-calendar:
-- when a request flips to 'accepted', each device's thread screen reads
-- the realtime UPDATE and inserts the event on the user's own default
-- calendar (iCloud / Google / Outlook — whatever they've configured on
-- their device). No server-side credentials, no OAuth refresh tokens.
-- ============================================================

-- ── 1. scheduling_requests ──────────────────────────────────
-- One row per "let's meet" attempt. proposed_slots is a jsonb array of
-- {start, end, tz} objects. accepted_slot mirrors that shape once the
-- recipient picks one. Local calendar event IDs are tracked client-side
-- via AsyncStorage (per-device) — they're not portable across devices
-- so there's no point persisting them server-side.
create table if not exists scheduling_requests (
  id                          uuid primary key default gen_random_uuid(),
  conversation_id             uuid not null references conversations(id) on delete cascade,
  proposer_id                 uuid not null references auth.users(id) on delete cascade,
  recipient_id                uuid not null references auth.users(id) on delete cascade,
  status                      text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'declined', 'cancelled')),
  proposed_slots              jsonb not null,
  accepted_slot               jsonb,
  title                       text not null default 'Quick chat',
  duration_min                int  not null default 30 check (duration_min between 15 and 180),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (proposer_id <> recipient_id),
  check (jsonb_typeof(proposed_slots) = 'array'),
  check (jsonb_array_length(proposed_slots) between 1 and 3)
);

create index if not exists idx_scheduling_conversation
  on scheduling_requests (conversation_id);
create index if not exists idx_scheduling_recipient_open
  on scheduling_requests (recipient_id, status)
  where status = 'proposed';

alter table scheduling_requests enable row level security;

create policy "scheduling: participant read"
  on scheduling_requests for select to authenticated
  using (proposer_id = auth.uid() or recipient_id = auth.uid());

-- Direct inserts disabled — clients must go through propose_meeting RPC,
-- which validates conversation membership.
create policy "scheduling: participant insert"
  on scheduling_requests for insert to authenticated
  with check (
    proposer_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.owner_id = auth.uid() or c.seeker_id = auth.uid())
    )
  );

-- Either side can update (accept/decline/cancel) — RPC enforces the
-- per-action permissions; this policy is the floor.
create policy "scheduling: participant update"
  on scheduling_requests for update to authenticated
  using (proposer_id = auth.uid() or recipient_id = auth.uid())
  with check (proposer_id = auth.uid() or recipient_id = auth.uid());

-- ── 2. messages.scheduling_request_id ───────────────────────
-- A chat message that represents a scheduling action carries the request
-- id. The MessageBubble checks this column to swap in SchedulingBubble.
-- ON DELETE SET NULL so deleting the request leaves a soft tombstone
-- (the original text body) in the thread.
alter table messages
  add column if not exists scheduling_request_id uuid
    references scheduling_requests(id) on delete set null;

create index if not exists idx_messages_scheduling
  on messages (scheduling_request_id)
  where scheduling_request_id is not null;

-- ── 3. propose_meeting RPC ──────────────────────────────────
-- Atomic insert: scheduling_request + chat message linked to it. Returns
-- the request id so the client can navigate / focus the new bubble.
create or replace function propose_meeting(
  p_conversation_id uuid,
  p_proposed_slots  jsonb,
  p_title           text,
  p_duration_min    int default 30
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller     uuid := auth.uid();
  v_other_id   uuid;
  v_request_id uuid;
  v_count      int  := jsonb_array_length(p_proposed_slots);
  v_msg_body   text;
begin
  if v_caller is null then raise exception 'not authenticated'; end if;
  if v_count < 1 or v_count > 3 then
    raise exception 'must propose 1-3 slots';
  end if;

  select case when c.owner_id = v_caller then c.seeker_id else c.owner_id end
    into v_other_id
    from conversations c
   where c.id = p_conversation_id
     and (c.owner_id = v_caller or c.seeker_id = v_caller);

  if v_other_id is null then raise exception 'not a participant'; end if;

  insert into scheduling_requests (
    conversation_id, proposer_id, recipient_id,
    proposed_slots, title, duration_min
  ) values (
    p_conversation_id, v_caller, v_other_id,
    p_proposed_slots, coalesce(nullif(trim(p_title), ''), 'Quick chat'),
    coalesce(p_duration_min, 30)
  )
  returning id into v_request_id;

  v_msg_body := '📅 Proposed ' || v_count || ' time' ||
    (case when v_count = 1 then '' else 's' end);

  insert into messages (conversation_id, sender_id, body, scheduling_request_id)
  values (p_conversation_id, v_caller, v_msg_body, v_request_id);

  return v_request_id;
end;
$$;

-- ── 4. respond_to_meeting RPC ───────────────────────────────
-- Recipient accepts (with slot index) / declines; proposer cancels.
-- Drops a system-style message into the thread so status changes are
-- visible to both sides.
create or replace function respond_to_meeting(
  p_request_id uuid,
  p_action     text,
  p_slot_index int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_request  scheduling_requests%rowtype;
  v_slot     jsonb;
  v_status   text;
  v_msg_body text;
begin
  if v_caller is null then raise exception 'not authenticated'; end if;
  if p_action not in ('accept', 'decline', 'cancel') then
    raise exception 'invalid action';
  end if;

  select * into v_request from scheduling_requests where id = p_request_id;
  if not found then raise exception 'request not found'; end if;
  if v_request.status <> 'proposed' then
    raise exception 'request already %', v_request.status;
  end if;

  if p_action = 'cancel' then
    if v_caller <> v_request.proposer_id then
      raise exception 'only proposer can cancel';
    end if;
    v_status   := 'cancelled';
    v_msg_body := '📅 Meeting request cancelled';

  elsif p_action = 'decline' then
    if v_caller <> v_request.recipient_id then
      raise exception 'only recipient can decline';
    end if;
    v_status   := 'declined';
    v_msg_body := '📅 Declined';

  else  -- accept
    if v_caller <> v_request.recipient_id then
      raise exception 'only recipient can accept';
    end if;
    if p_slot_index is null then raise exception 'slot_index required'; end if;
    v_slot := v_request.proposed_slots -> p_slot_index;
    if v_slot is null then raise exception 'invalid slot_index'; end if;
    v_status   := 'accepted';
    v_msg_body := '📅 Confirmed';
  end if;

  update scheduling_requests
     set status        = v_status,
         accepted_slot = case when v_status = 'accepted' then v_slot else null end,
         updated_at    = now()
   where id = p_request_id;

  insert into messages (conversation_id, sender_id, body, scheduling_request_id)
  values (v_request.conversation_id, v_caller, v_msg_body, p_request_id);
end;
$$;

-- ── 5. Realtime ─────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table scheduling_requests;
  end if;
exception
  when duplicate_object then null;
end $$;
