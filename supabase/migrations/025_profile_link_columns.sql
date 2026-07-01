-- ── Profile link columns ──────────────────────────────────────
-- These columns are already READ by the app (PartnerProfileIsland's
-- "LINKS" section selects github_url / linkedin_url / portfolio_url /
-- resume_url) and now WRITTEN by the résumé import (resumeLinksPatch).
-- They exist in the live DB but were never captured in a migration —
-- this tracks them and guarantees presence in any fresh environment.
-- `if not exists` makes it a no-op where they already exist.
alter table profiles
  add column if not exists github_url    text,
  add column if not exists linkedin_url  text,
  add column if not exists portfolio_url text,
  add column if not exists resume_url    text;
