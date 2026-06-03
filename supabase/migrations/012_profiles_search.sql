-- 011_profiles_search.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: the "new chat" people-search (and any direct cross-user profile read)
-- returned nothing. 006_avatar_fix added a "profiles: self read" SELECT policy
-- scoped to `id = auth.uid()`, so a name query over OTHER users matched zero
-- rows — RLS filters them out silently, surfacing as "No one found". The
-- discovery feed still works only because it reads candidates through the
-- `security definer` matching RPCs (compat_for_project / compat_projects_for_
-- seeker) which bypass RLS; the people-search hits the table directly and has
-- no such bypass.
--
-- Ambit is a discovery product — signed-in users are meant to find one another
-- — so allow authenticated users to read the profiles table. This exposes only
-- the public profile surface (name, photo, campus, skills, vibe + the matching
-- vector/stats). Emails / phone numbers live in auth.users, which stays private
-- and is NOT affected by this policy.
--
-- This coexists with "profiles: self read" (multiple SELECT policies are OR'd);
-- self read is kept so nothing that referenced it by name breaks.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles enable row level security;

drop policy if exists "profiles: authenticated read" on profiles;
create policy "profiles: authenticated read"
  on profiles for select to authenticated
  using (true);
