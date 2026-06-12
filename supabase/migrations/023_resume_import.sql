-- ============================================================
-- 023_resume_import.sql
-- Storage for the résumé-import feature: a PRIVATE, owner-scoped
-- `resumes` bucket. The parse-resume edge function downloads the
-- uploaded PDF with the service role, extracts text, and deletes it
-- after parsing — we keep only the extracted JSON, never the file.
--
-- Unlike project-images / avatars, this bucket is NOT public: a résumé
-- is PII. No public-read policy; owners can read/write only their own
-- folder, and the function reads via the service role.
-- Path convention: `{user_id}/resume.pdf`
-- ============================================================

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do update
  set public = false,
      name   = excluded.name;

drop policy if exists "resumes: owner upload" on storage.objects;
drop policy if exists "resumes: owner update" on storage.objects;
drop policy if exists "resumes: owner delete" on storage.objects;
drop policy if exists "resumes: owner read"   on storage.objects;

create policy "resumes: owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "resumes: owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "resumes: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can read their own résumé (the service role reads server-side, but
-- this lets the client confirm/replace its own upload). Still no public read.
create policy "resumes: owner read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
