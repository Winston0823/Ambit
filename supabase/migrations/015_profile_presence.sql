-- ============================================================
-- 015_profile_presence.sql · Presence for the chat header island.
-- The client stamps this on app foreground / thread focus; the UI
-- renders "Active <relative>" (e.g. "Active 2m ago"). For live
-- "online now", prefer a Supabase Realtime Presence channel (no
-- schema) layered on top of this.
-- ============================================================

alter table profiles
  add column if not exists last_active_at timestamptz;
