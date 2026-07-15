-- 033_contact_card.sql — "Share contact info" chat message.
--
-- A contact card is a snapshot of the SENDER's own contact details (name,
-- .edu email, profile links) taken at send time. Stored as a jsonb column so
-- it needs no ref table, no hydration round-trip, and — critically — keeps
-- kind = 'user' so it renders as a normal bubble (not a centered system pill).
--
-- Additive + idempotent. The messages insert RLS ("sender_id = auth.uid() AND
-- caller is a participant") already covers the new column; no policy change.

alter table messages add column if not exists contact_card jsonb;

-- Build + send the contact card SERVER-SIDE from the caller's own profile +
-- auth email. The client must not supply the identity fields — otherwise a
-- modified client could forge a card impersonating someone else (spoofed
-- identity). Only the caller's real name/email/links are ever stored.
create or replace function share_contact_card(
  p_conversation_id uuid,
  p_client_id       uuid default null
)
returns messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_card   jsonb;
  v_msg    messages;
begin
  -- Caller must be a participant of the conversation.
  if not exists (
    select 1 from conversations c
    where c.id = p_conversation_id
      and (c.owner_id = v_caller or c.seeker_id = v_caller)
  ) then
    raise exception 'not a participant of this conversation';
  end if;

  -- Authoritative snapshot — sender's own data only.
  select jsonb_build_object(
           'name',          p.name,
           'email',         (select u.email from auth.users u where u.id = v_caller),
           'github_url',    p.github_url,
           'linkedin_url',  p.linkedin_url,
           'portfolio_url', p.portfolio_url
         )
    into v_card
  from profiles p
  where p.id = v_caller;

  insert into messages (id, conversation_id, sender_id, body, contact_card)
  values (coalesce(p_client_id, gen_random_uuid()), p_conversation_id, v_caller,
          'Shared contact info', v_card)
  returning * into v_msg;

  return v_msg;
end;
$$;

grant execute on function share_contact_card(uuid, uuid) to authenticated;
