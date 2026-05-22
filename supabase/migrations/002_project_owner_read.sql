-- ============================================================
-- 002_project_owner_read.sql
-- Add a second SELECT policy so owners can read their own
-- projects regardless of `active` state. The existing policy
-- (projects: authenticated read active) only lets users see
-- active projects; without this addition, a paused project
-- disappears from the owner's own "My projects" list.
-- Postgres OR-combines RLS policies of the same command, so
-- anyone can still read active rows AND owners can additionally
-- read their own inactive rows.
-- ============================================================

create policy "projects: owner read own"
  on projects for select
  to authenticated
  using (owner_id = auth.uid());
