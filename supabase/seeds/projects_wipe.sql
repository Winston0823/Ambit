-- ============================================================
-- projects_wipe.sql · Remove the temporary seeded projects + founders
-- Run in the Supabase SQL Editor whenever you want them gone.
--
-- Targets ONLY the projects-seed namespaces (e5… projects, d4… founders) so
-- it never touches the seeded SEEKERS (c3… / seekers_wipe.sql). Deleting the
-- projects cascades their matches/conversations; deleting the founder
-- auth.users cascades their profiles.
-- ============================================================

-- Seed projects (cascades matches + conversations referencing them).
delete from projects
  where id::text like 'e5000000-0000-0000-0000-%' or is_seed;

-- Founder profiles + auth accounts.
delete from profiles   where id::text like 'd4000000-0000-0000-0000-%';
delete from auth.users where id::text like 'd4000000-0000-0000-0000-%';

-- Sanity check (should return 0):
-- select count(*) from projects where is_seed;
