-- ============================================================
-- 007_portfolio.sql  ·  Per-user portfolio entries (the bubbles
-- shown on a seeker's discovery card + edited via the WYSIWYG
-- profile screen). Replaces the in-memory `useState([])` array
-- in profile.tsx with real persistence.
-- ============================================================
-- Schema:
--   portfolio_items
--     id          uuid    pk
--     user_id     uuid    references auth.users(id) on delete cascade
--     title       text    short label shown below the bubble (NOT NULL,
--                         length 1..60)
--     description text    full body shown in PortfolioModal (NOT NULL,
--                         length 1..400)
--     image_url   text    optional path in the (future) portfolio
--                         storage bucket OR external URL. Null = render
--                         the gradient placeholder.
--     position    int     ordering within a user's portfolio. Lower = first.
--     created_at  timestamptz
--     updated_at  timestamptz
--
-- RLS: owner can write their own; anyone authenticated can read
-- anyone's. Public read so portfolio bubbles surface on the
-- owner-side discovery deck without an extra join through profiles.
-- ============================================================

-- ── 1. Table ────────────────────────────────────────────────
create table if not exists portfolio_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 60),
  description text not null check (char_length(description) between 1 and 400),
  image_url   text,
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_portfolio_items_user_position
  on portfolio_items (user_id, position);

-- Bump updated_at on every change so the client can detect staleness.
create or replace function trg_portfolio_items_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists portfolio_items_set_updated_at on portfolio_items;
create trigger portfolio_items_set_updated_at
  before update on portfolio_items
  for each row execute function trg_portfolio_items_set_updated_at();

-- ── 2. RLS ──────────────────────────────────────────────────
alter table portfolio_items enable row level security;

-- Owner full CRUD on their own rows.
drop policy if exists "portfolio: owner write" on portfolio_items;
create policy "portfolio: owner write"
  on portfolio_items for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Anyone authenticated can read anyone's portfolio. The discovery
-- deck shows these as part of the seeker card; you need to see
-- others' portfolios before you've matched with them. If you want
-- to gate this later (e.g. only-matched-can-view), tighten the
-- USING clause; for now this matches the existing seeker-card
-- assumption that name + vibe + skills + portfolio are all
-- public-by-default within the authenticated graph.
drop policy if exists "portfolio: authenticated read" on portfolio_items;
create policy "portfolio: authenticated read"
  on portfolio_items for select to authenticated
  using (true);

-- ── 3. Storage bucket for portfolio images ──────────────────
-- Same shape as the avatars bucket: public read so getPublicUrl
-- resolves cheaply; owner-scoped writes by path. Path convention:
--   `{user_id}/{portfolio_item_id}.{ext}`
insert into storage.buckets (id, name, public)
values ('portfolio-images', 'portfolio-images', true)
on conflict (id) do update
  set public = true,
      name   = excluded.name;

drop policy if exists "portfolio-images: owner upload" on storage.objects;
drop policy if exists "portfolio-images: owner update" on storage.objects;
drop policy if exists "portfolio-images: owner delete" on storage.objects;
drop policy if exists "portfolio-images: public read"  on storage.objects;

create policy "portfolio-images: owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'portfolio-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "portfolio-images: owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'portfolio-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'portfolio-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "portfolio-images: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'portfolio-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "portfolio-images: public read"
  on storage.objects for select to public
  using (bucket_id = 'portfolio-images');
