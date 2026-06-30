-- ============================================================
-- 027_owner_stage.sql · Private owner CRM stage per conversation
-- The owner's own funnel tag for a candidate (New / Screening /
-- Interviewing / Finalist), distinct from the shared closure-loop
-- `status`. Free text (like pass_reason) — the canonical set lives in
-- TS (lib/closureLoop.ts OWNER_STAGES); no CHECK so it stays flexible.
-- ============================================================

alter table conversations
  add column if not exists owner_stage text;

-- Set the owner's private stage. OWNER ONLY — the seeker can't write it
-- (this is the founder's private pipeline). Security-definer + participant
-- guard, mirroring set_conversation_muted (019).
create or replace function set_owner_stage(p_conversation_id uuid, p_stage text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations
  set owner_stage = p_stage
  where id = p_conversation_id
    and owner_id = auth.uid();   -- owner only, not the seeker
end;
$$;

grant execute on function set_owner_stage(uuid, text) to authenticated;
