-- ============================================================
-- 026_seed_flag.sql · Temporary-seed marker
-- Adds an explicit is_seed flag so demo/seed rows can be bulk-wiped
-- with zero risk of touching real users. Set true on every seeded row;
-- wipe later with `delete ... where is_seed`.
-- ============================================================

alter table profiles
  add column if not exists is_seed boolean not null default false;

alter table portfolio_items
  add column if not exists is_seed boolean not null default false;

-- Partial indexes keep the seed lookups/wipes cheap (and tiny — only true rows).
create index if not exists idx_profiles_is_seed
  on profiles (is_seed) where is_seed;
create index if not exists idx_portfolio_items_is_seed
  on portfolio_items (is_seed) where is_seed;
