-- ── Project attachments on messages ──────────────────────────────────
-- A reach-out (or any message) can carry a project the sender wants to
-- surface. The client renders such a message as a tappable project card
-- instead of plain text — mirroring the scheduling_request_id /
-- availability_poll_id linked-bubble pattern (migrations 008 / 009).
--
-- Nullable + ON DELETE SET NULL so deleting a project never orphans or
-- removes the conversation history; the bubble just falls back to its
-- caption text once the reference is gone.

alter table messages
  add column if not exists project_ref_id uuid references projects(id) on delete set null;

create index if not exists idx_messages_project_ref
  on messages (project_ref_id);
