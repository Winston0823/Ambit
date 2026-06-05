-- ============================================================
-- 016_conversation_mute_archive.sql · Per-participant inbox actions.
-- `muted_by` / `archived_by` hold the user ids who muted / archived a
-- conversation (array so each participant controls their own view).
-- Participants already have an UPDATE policy on `conversations` (used
-- by pin/unpin in 010), so these columns are writable without a new
-- policy. Toggle client-side with array append/remove.
-- ============================================================

alter table conversations
  add column if not exists muted_by    uuid[] not null default '{}',
  add column if not exists archived_by uuid[] not null default '{}';

create index if not exists idx_conversations_archived_by on conversations using gin (archived_by);
