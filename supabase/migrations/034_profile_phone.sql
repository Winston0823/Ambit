-- 034_profile_phone.sql — optional phone number on profiles, surfaced in the
-- shared contact card. Strictly opt-in (null by default) and only ever exposed
-- when the user deliberately shares their contact card — never on discovery.

alter table profiles add column if not exists phone text;

-- Recreate share_contact_card (from 033) to include phone in the authoritative,
-- server-built snapshot. Still identity-safe: sender's own data only.
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
  if not exists (
    select 1 from conversations c
    where c.id = p_conversation_id
      and (c.owner_id = v_caller or c.seeker_id = v_caller)
  ) then
    raise exception 'not a participant of this conversation';
  end if;

  select jsonb_build_object(
           'name',          p.name,
           'email',         (select u.email from auth.users u where u.id = v_caller),
           'phone',         p.phone,
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
