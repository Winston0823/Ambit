-- ============================================================
-- 028_project_seed_flag.sql · is_seed flag on projects
-- Completes the seed-marker set (026 added it to profiles +
-- portfolio_items). Lets seeded demo projects be bulk-wiped safely.
-- ============================================================

alter table projects
  add column if not exists is_seed boolean not null default false;

create index if not exists idx_projects_is_seed
  on projects (is_seed) where is_seed;
