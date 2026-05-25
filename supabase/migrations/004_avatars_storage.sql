-- ============================================================
-- 004_avatars_storage.sql  ·  Public avatars bucket + RLS
-- ============================================================
-- Why: profile.tsx and OnboardingContext.tsx upload via
--   supabase.storage.from('avatars').upload(...)
-- and rely on .getPublicUrl() to resolve a renderable URL. The
-- bucket itself was never created by any prior migration, so every
-- upload silently failed and every <Image src={photo_url}> rendered
-- nothing. Avatars surface in:
--   - DiscoveryCard (owner viewing seekers)
--   - InboxRow (chat list partner thumbnail)
--   - MessageBubble (sender pip)
--   - profile.tsx (your own card)
--
-- Path convention (client side):
--   `{user_id}/avatar.{ext}`
-- Each user owns one subfolder under the bucket root.
-- ============================================================

-- ── 1. Bucket ───────────────────────────────────────────────
-- Public so the URL returned by .getPublicUrl() resolves without
-- minting a signed URL on every render. Avatars aren't sensitive —
-- they show up in discovery to anyone in the deck anyway.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
  set public = true,
      name   = excluded.name;

-- ── 2. Policies ─────────────────────────────────────────────
-- Drop first so the migration is re-runnable without errors.
drop policy if exists "avatars: owner upload" on storage.objects;
drop policy if exists "avatars: owner update" on storage.objects;
drop policy if exists "avatars: owner delete" on storage.objects;
drop policy if exists "avatars: public read"  on storage.objects;

-- Owner writes — the first path segment (folder name) must match
-- the caller's auth uid. storage.foldername returns a 1-indexed
-- text[] of the path split on '/'. For path 'abc-uuid/avatar.jpg'
-- it returns {'abc-uuid'}, so [1] is the user id.
create policy "avatars: owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- profile.tsx and onboarding both use upsert: true → triggers
-- an UPDATE if the row already exists. Same path-scope check.
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

-- Public read — anyone (signed-in or not) can fetch avatars by URL.
-- Required for getPublicUrl() to resolve from <Image> sources in
-- the running app and from any anon link previews.
create policy "avatars: public read"
  on storage.objects for select to public
  using (bucket_id = 'avatars');
