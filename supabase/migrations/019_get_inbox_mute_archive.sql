-- ============================================================
-- 019_get_inbox_mute_archive.sql · Surface per-user mute/archive in the inbox.
-- The columns live on conversations (016), but get_inbox returns a fixed
-- shape — so add is_muted / is_archived (computed against auth.uid()) plus
-- two RPCs to toggle them. The client hides archived rows + shows a muted
-- badge; rows are still returned (flagged) so Undo + a future Archived view
-- work without another RPC change.
-- ============================================================

-- Return shape changes (two new columns), so the old function must be dropped
-- first — Postgres refuses to change a function's OUT/return type in place.
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

-- Toggle mute for the calling user (participants only).
create or replace function set_conversation_muted(p_conversation_id uuid, p_muted boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations
  set muted_by = case
    when p_muted and not (auth.uid() = any(muted_by)) then array_append(muted_by, auth.uid())
    when not p_muted then array_remove(muted_by, auth.uid())
    else muted_by end
  where id = p_conversation_id
    and (owner_id = auth.uid() or seeker_id = auth.uid());
end;
$$;

-- Toggle archive for the calling user (participants only).
create or replace function set_conversation_archived(p_conversation_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations
  set archived_by = case
    when p_archived and not (auth.uid() = any(archived_by)) then array_append(archived_by, auth.uid())
    when not p_archived then array_remove(archived_by, auth.uid())
    else archived_by end
  where id = p_conversation_id
    and (owner_id = auth.uid() or seeker_id = auth.uid());
end;
$$;

grant execute on function get_inbox()                              to authenticated;
grant execute on function set_conversation_muted(uuid, boolean)    to authenticated;
grant execute on function set_conversation_archived(uuid, boolean) to authenticated;
