-- 038_symmetric_sweep_v2.sql — symmetric 72h auto-decline, crash-proof.
--
-- Second attempt at the symmetric sweep (the first, 036, was rolled back after
-- it broke inbox loading — root cause never captured because the failure
-- aborted get_inbox itself). This version keeps the corrected semantics:
--
--   • Sweeps every ACTIVE past-deadline conversation the CALLER participates
--     in (either side) — so a sender's own inbox load expires their stale
--     outgoing invites; no recipient activity required.
--   • Recipient = the participant who did NOT send the first message.
--   • Reply-based: declined only if the recipient never sent a kind='user'
--     message. Reads alone don't keep it alive.
--
-- …but makes availability the hard guarantee:
--
--   • Each row's decline is wrapped in its own exception block — a bad row is
--     skipped, the rest proceed.
--   • The whole sweep body is additionally wrapped — ANY unexpected failure
--     returns the count so far instead of raising. get_inbox can never be
--     taken down by the sweep again. (Trade-off, acknowledged: unknown errors
--     are swallowed; a skipped row simply stays active until a later sweep.)

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

  begin
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
      begin
        if v_conv.initiator is null then continue; end if;

        v_recipient := case when v_conv.initiator = v_conv.owner_id
                            then v_conv.seeker_id else v_conv.owner_id end;

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
      exception when others then
        -- One bad row must not abort the sweep (or the inbox). Skip it.
        null;
      end;
    end loop;
  exception when others then
    -- The sweep must never take get_inbox down. Return what we managed.
    return v_count;
  end;

  return v_count;
end;
$$;

grant execute on function sweep_auto_declined_for_user() to authenticated;
