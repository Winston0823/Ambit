-- ============================================================
-- seekers_wipe.sql · Remove the temporary seeded seekers
-- Run in the Supabase SQL Editor whenever you want them gone.
--
-- Two independent guards so this is safe:
--   1. is_seed flag (set by seekers_seed.sql) for profiles + portfolio_items
--   2. the fixed c3000000-…-NN UUID namespace for the auth.users rows
-- Order matters (children first) because of the auth.users FK cascade.
-- ============================================================

-- Portfolio + profile rows (anything explicitly marked as seed).
delete from portfolio_items where is_seed;
delete from profiles        where is_seed;

-- The auth.users rows (deleting these would cascade the above too, but we
-- remove children first so this works even if is_seed was ever cleared).
delete from auth.users
  where id::text like 'c3000000-0000-0000-0000-%';

-- Sanity check (should return 0):
-- select count(*) from profiles where is_seed;
