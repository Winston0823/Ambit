-- 036_symmetric_auto_decline.sql — make the 72h auto-decline actually fire.
--
-- The 005 sweep had three holes that let expired reach-outs sit "active"
-- forever:
--   1. It only swept conversations where the CALLER was the owner-recipient —
--      so an invite you SENT never expired unless the recipient opened their
--      own inbox (dormant/seeded accounts never do).
--   2. Owner→seeker reach-outs could never decline at all: its "no reply"
--      test was "owner has sent no message", which is always false when the
--      owner initiated. There was no seeker-recipient variant.
--   3. Merely READING a reach-out exempted it forever (read-state condition),
--      contradicting the reply-only closure thesis (see 024).
--
-- New semantics, symmetric and reply-based: an ACTIVE conversation past its
-- auto_decline_at is declined when the RECIPIENT (the participant who did not
-- send the first message) has never sent a user message. The sweep covers
-- every conversation the CALLER participates in — so a sender's own inbox
-- load expires their stale outgoing invites, no recipient activity required.

create or replace function sweep_auto_declined_for_user()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller    uuid := auth.uid();
  v_count     int := 0;
  v_conv      record;
  v_recipient uuid;
begin
  if v_caller is null then return 0; end if;

  for v_conv in
    select c.id, c.owner_id, c.seeker_id,
           (select m0.sender_id
              from messages m0
             where m0.conversation_id = c.id
             order by m0.created_at asc
             limit 1) as initiator
      from conversations c
     where c.status = 'active'
       and c.auto_decline_at < now()
       and (c.owner_id = v_caller or c.seeker_id = v_caller)
  loop
    -- No first message at all → nothing to expire against; skip.
    if v_conv.initiator is null then continue; end if;

    v_recipient := case when v_conv.initiator = v_conv.owner_id
                        then v_conv.seeker_id else v_conv.owner_id end;

    -- Reply-based: only a real message from the recipient keeps it alive.
    if not exists (
      select 1 from messages m
      where m.conversation_id = v_conv.id
        and m.sender_id = v_recipient
        and m.kind = 'user'
    ) then
      update conversations
         set status = 'auto_declined'
       where id = v_conv.id;

      insert into messages (conversation_id, sender_id, body, kind)
      values (
        v_conv.id,
        v_recipient,
        'This reach-out expired without a reply.',
        'system_auto_declined'
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function sweep_auto_declined_for_user() to authenticated;
