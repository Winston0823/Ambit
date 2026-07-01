-- ============================================================
-- 021_security_hardening.sql
-- Closes two gaps found in a pre-launch security review:
--   1. compat_for_project is SECURITY DEFINER but never pinned its
--      search_path — a known Postgres privilege-escalation vector, since
--      a definer function bypasses RLS and an attacker-controlled
--      search_path could resolve unqualified names to malicious objects.
--   2. skill_aliases had RLS disabled, so with Supabase's default role
--      grants it was readable/writable by anyone holding the anon key.
--      A user could pollute or delete the skill-normalization data and
--      quietly break matching.
-- ============================================================

-- ── 1. Pin search_path on the remaining SECURITY DEFINER function ──
-- compat_projects_for_seeker was already re-created with search_path in
-- 011; compat_for_project is the only one still missing it.
alter function public.compat_for_project(uuid, int) set search_path = public;

-- ── 2. Lock down skill_aliases (read-only reference data) ──────────
alter table skill_aliases enable row level security;

-- Regular users may read the alias map (normalize_skills runs as a
-- SECURITY DEFINER function so it bypasses RLS regardless). No insert/
-- update/delete policies exist, so writes are denied for anon +
-- authenticated once RLS is on — only the service role can modify it.
drop policy if exists "skill_aliases: authenticated read" on skill_aliases;
create policy "skill_aliases: authenticated read"
  on skill_aliases for select
  to authenticated
  using (true);
