-- ============================================================
-- 029_revert_hire_proposal.sql · ADDITIVE.
-- UX-audit fix (2026-07-01): a `hired_pending` conversation had no exit
-- other than the recipient confirming. The recipient couldn't decline
-- ("Not yet") and the proposer couldn't retract ("Withdraw proposal"),
-- so a stray/premature proposal dead-ended the thread (composer stays
-- open but the banner is stuck on "Confirm?" forever).
--
-- conversations has RLS with NO participant UPDATE policy — status
-- transitions all go through security-definer RPCs (see 005). So the
-- revert must also be an RPC. This one moves hired_pending → active for
-- either participant and clears hired_proposed_by, mirroring the guard
-- style of propose_hire / confirm_hire. Idempotent-safe: raises a clean
-- error if the conversation isn't actually pending.
-- ============================================================

create or replace function revert_hire_proposal(p_conversation_id uuid)
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
  -- Only a pending proposal can be reverted. Already-active is a no-op
  -- (a double-tap from either side); terminal states can't be reopened.
  if v_status = 'active' then
    return;
  end if;
  if v_status <> 'hired_pending' then
    raise exception 'not pending';
  end if;

  update conversations
     set status            = 'active',
         hired_proposed_by = null
   where id = p_conversation_id;
end;
$$;

grant execute on function revert_hire_proposal(uuid) to authenticated;
