-- ============================================================
-- 006_avatar_fix.sql  ·  Defensive re-apply of avatar storage
-- policies + ensure profiles has an owner-update RLS policy.
-- ============================================================
-- The original 004_avatars_storage.sql may have applied
-- partially (bucket created, policies skipped) depending on the
-- order operations ran in the SQL editor. This migration:
--
--   1. Re-ensures the avatars bucket exists and is public.
--   2. Drops and recreates the four owner-write + public-read
--      storage policies so they're guaranteed present.
--   3. Adds (idempotently) an UPDATE-own-row policy on profiles
--      so the `profiles.update({photo_url: ...})` call from the
--      app actually persists. Without this, the avatar upload
--      succeeds but the new URL never lands on the row — the
--      profile reverts on next fetch.
--
-- Safe to run on any state — every operation is idempotent.
-- ============================================================

-- ── 1. Avatars bucket ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
  set public = true,
      name   = excluded.name;

-- ── 2. Storage.objects policies for avatars ────────────────
drop policy if exists "avatars: owner upload" on storage.objects;
drop policy if exists "avatars: owner update" on storage.objects;
drop policy if exists "avatars: owner delete" on storage.objects;
drop policy if exists "avatars: public read"  on storage.objects;

create policy "avatars: owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: public read"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

-- ── 3. Profiles UPDATE-own-row policy ──────────────────────
-- Without this, the .update({photo_url: ...}) call from the
-- client gets silently rejected by RLS even though the upload
-- to storage succeeded. The image appears briefly (local URI),
-- then the next profile fetch returns the old null photo_url
-- and reverts the UI to the cream-circle placeholder.
alter table profiles enable row level security;

drop policy if exists "profiles: owner update" on profiles;
create policy "profiles: owner update"
  on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Also ensure SELECT is allowed so the profile-fetch path works
-- for the signed-in user. Other users' profile reads are gated
-- by whatever existing SELECT policy 001_matching.sql / the
-- matching RPCs need; this one just makes self-read explicit.
drop policy if exists "profiles: self read" on profiles;
create policy "profiles: self read"
  on profiles for select to authenticated
  using (id = auth.uid());
