-- ============================================================
-- 030_account_deletion_cascade.sql · Make account deletion safe
--
-- The delete-account edge function calls auth.admin.deleteUser(), which
-- hard-deletes the auth.users row. That only succeeds cleanly if EVERY
-- table referencing auth.users(id) either CASCADEs or SET NULLs on delete.
-- Two columns were created with no delete rule (→ NO ACTION), which would
-- BLOCK deletion for any user who has passed on / proposed a hire in a
-- conversation. This migration fixes them and guarantees profiles cascades.
--
-- Run:  supabase db push
-- ============================================================

-- ── 1. conversations.passed_by / hired_proposed_by ──────────────────────
-- Nullable audit columns ("who passed", "who proposed the hire"). A deleted
-- user should NOT block the delete, and losing that attribution is fine →
-- ON DELETE SET NULL. Constraint names are Postgres' auto-generated defaults
-- for `add column ... references` (<table>_<column>_fkey).
alter table conversations
  drop constraint if exists conversations_passed_by_fkey;
alter table conversations
  add constraint conversations_passed_by_fkey
    foreign key (passed_by) references auth.users(id) on delete set null;

alter table conversations
  drop constraint if exists conversations_hired_proposed_by_fkey;
alter table conversations
  add constraint conversations_hired_proposed_by_fkey
    foreign key (hired_proposed_by) references auth.users(id) on delete set null;

-- ── 2. profiles.id → auth.users(id) must be ON DELETE CASCADE ────────────
-- The profiles table was created outside migrations (dashboard bootstrap),
-- so its FK delete rule is unverified in the repo. Discover whatever FK it
-- has to auth.users, drop it, and recreate as CASCADE. Idempotent: if it is
-- already CASCADE this is a semantic no-op. Safe re: orphans — the seed data
-- inserts auth.users BEFORE profiles, so every profiles.id has a match.
do $$
declare
  fk_name text;
begin
  select con.conname into fk_name
  from pg_constraint con
  join pg_class      rel  on rel.oid  = con.conrelid
  join pg_namespace  nsp  on nsp.oid  = rel.relnamespace
  join pg_class      frel on frel.oid = con.confrelid
  join pg_namespace  fnsp on fnsp.oid = frel.relnamespace
  where con.contype = 'f'
    and nsp.nspname  = 'public' and rel.relname  = 'profiles'
    and fnsp.nspname = 'auth'   and frel.relname = 'users'
  limit 1;

  if fk_name is not null then
    execute format('alter table public.profiles drop constraint %I', fk_name);
  end if;

  alter table public.profiles
    add constraint profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
end $$;
