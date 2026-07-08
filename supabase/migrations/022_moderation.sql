-- ============================================================
-- 022_moderation.sql
-- User safety primitives required for App Store review of any app
-- with user-generated content / messaging (Guideline 1.2):
--   • block another user
--   • report a user or a conversation for review
-- ============================================================

-- ── 1. blocked_users ────────────────────────────────────────
-- One row per (blocker, blocked) pair. The blocker "owns" the row.
create table if not exists blocked_users (
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists idx_blocked_users_blocker on blocked_users (blocker_id);

alter table blocked_users enable row level security;

-- You can see, create, and remove only your own blocks.
drop policy if exists "blocked_users: own all" on blocked_users;
create policy "blocked_users: own all"
  on blocked_users for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

-- ── 2. content_reports ──────────────────────────────────────
-- A report filed by one user against another (optionally scoped to a
-- conversation or a specific message). Reviewed out-of-band by an
-- admin; regular users can only INSERT their own reports and never
-- read anyone's, so this doubles as an abuse-audit log.
create table if not exists content_reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null references auth.users(id) on delete cascade,
  reported_user_id  uuid not null references auth.users(id) on delete cascade,
  conversation_id   uuid references conversations(id) on delete set null,
  message_id        uuid references messages(id) on delete set null,
  reason            text not null check (char_length(reason) between 1 and 60),
  details           text check (char_length(details) <= 1000),
  created_at        timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

create index if not exists idx_content_reports_reported on content_reports (reported_user_id);

alter table content_reports enable row level security;

-- Users may file (insert) their own reports. No select/update/delete
-- policies exist, so once RLS is on, regular users can't read or alter
-- reports — only the service role (admin tooling) can.
drop policy if exists "content_reports: reporter insert" on content_reports;
create policy "content_reports: reporter insert"
  on content_reports for insert to authenticated
  with check (reporter_id = auth.uid());
