-- ============================================================
-- 017_match_undo_and_notes.sql · Undo-last-swipe + saved notes.
-- Saves/swipes are rows in `matches` (outcome: applied/saved/passed).
--   • Undo last swipe = DELETE the seeker's own match row → add a
--     seeker DELETE policy (SELECT/INSERT/UPDATE already exist in 001).
--   • Saved note = a freeform `note` the seeker attaches to a saved
--     card (the "sticky note by the pfp"). The existing seeker UPDATE
--     policy already permits writing it.
-- ============================================================

alter table matches
  add column if not exists note text;

drop policy if exists "matches: seeker delete own" on matches;
create policy "matches: seeker delete own"
  on matches for delete to authenticated
  using (seeker_id = auth.uid());
