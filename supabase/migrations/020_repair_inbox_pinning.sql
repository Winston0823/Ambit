-- ============================================================
-- 020_repair_inbox_pinning.sql · REPAIR.
-- This DB skipped migration 010 (pinned chats), so conversations has no
-- is_pinned/pinned_at. Migration 019 then recreated get_inbox referencing
-- those columns — plpgsql is late-bound, so it *created* fine but throws
-- "column c.is_pinned does not exist" at call time, which empties the inbox.
--
-- This migration is idempotent and self-contained: it adds the missing
-- pinning columns + RPCs (no-ops if 010 was applied) and recreates get_inbox
-- with the full shape (pinning + mute/archive). Safe to run on any DB.
-- ============================================================

-- ── 1. Pinning columns + index (from 010) ───────────────────────
alter table conversations
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz;

create index if not exists idx_conversations_pinned
  on conversations (is_pinned, pinned_at desc)
  where is_pinned = true;

-- ── 2. Pin / unpin RPCs (from 010) ──────────────────────────────
create or replace function pin_conversation(p_conversation_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me        uuid := auth.uid();
  v_owner_id  uuid;
  v_seeker_id uuid;
  v_pinned_count int;
  v_now       timestamptz := now();
begin
  select owner_id, seeker_id into v_owner_id, v_seeker_id
    from conversations where id = p_conversation_id;
  if v_owner_id is null then raise exception 'conversation_not_found'; end if;
  if v_me <> v_owner_id and v_me <> v_seeker_id then raise exception 'not_a_participant'; end if;

  select count(*) into v_pinned_count
    from conversations c
   where c.is_pinned = true
     and c.id <> p_conversation_id
     and (c.owner_id = v_me or c.seeker_id = v_me);
  if v_pinned_count >= 4 then raise exception 'pin_limit_reached'; end if;

  update conversations set is_pinned = true, pinned_at = v_now where id = p_conversation_id;
  return v_now;
end;
$$;

create or replace function unpin_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me        uuid := auth.uid();
  v_owner_id  uuid;
  v_seeker_id uuid;
begin
  select owner_id, seeker_id into v_owner_id, v_seeker_id
    from conversations where id = p_conversation_id;
  if v_owner_id is null then raise exception 'conversation_not_found'; end if;
  if v_me <> v_owner_id and v_me <> v_seeker_id then raise exception 'not_a_participant'; end if;
  update conversations set is_pinned = false, pinned_at = null where id = p_conversation_id;
end;
$$;

-- ── 3. Recreate get_inbox (pinning + mute/archive) ──────────────
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
  where c.owner_id = (select id from me) or c.seeker_id = (select id from me)
  order by
    case when c.status = 'hired_pending' then 0 else 1 end,
    case when c.is_pinned                  then 0 else 1 end,
    c.pinned_at desc nulls last,
    c.last_message_at desc;
end;
$$;

grant execute on function pin_conversation(uuid)   to authenticated;
grant execute on function unpin_conversation(uuid) to authenticated;
grant execute on function get_inbox()              to authenticated;
