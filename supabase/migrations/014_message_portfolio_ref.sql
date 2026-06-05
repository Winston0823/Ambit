-- ============================================================
-- 014_message_portfolio_ref.sql · Portfolio-highlight attachments
-- on messages. Mirrors project_ref_id (011): a message can carry a
-- portfolio highlight the sender wants to surface; the client renders
-- it as a tappable highlight card instead of plain text.
--
-- Nullable + ON DELETE SET NULL so deleting a highlight never orphans
-- the conversation; the bubble falls back to its caption text.
-- ============================================================

alter table messages
  add column if not exists portfolio_ref_id uuid references portfolio_items(id) on delete set null;

create index if not exists idx_messages_portfolio_ref
  on messages (portfolio_ref_id);
