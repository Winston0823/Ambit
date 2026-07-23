-- ============================================================
-- 040_inbox_avatar_id.sql · Surface the partner's monster mark
-- (profiles.avatar_id) through get_inbox so chat surfaces can render
-- the identity visual without ever reading photo_url on the client.
--
-- Additive: partner_photo_url stays in the payload (still consumed by
-- the projects tab, out of scope here). Chat surfaces render the monster
-- mark by default and swap in a real photo ONLY via fetch_peer_photos
-- (039) — the single mutual-reveal gate. partner.avatar_id is public
-- (selectable), so exposing it here leaks nothing.
--
-- Body copied verbatim from 031_safety.sql; the only change is the added
-- partner_avatar_id column in the RETURNS TABLE + select list. DROP first
-- because the return signature changes.
-- ============================================================

drop function if exists get_inbox();
create or replace function get_inbox()
returns table (
  conversation_id              uuid,
  project_id                   uuid,
  project_title                text,
  partner_id                   uuid,
  partner_name                 text,
  partner_avatar_id            text,
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
    partner.avatar_id,
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
