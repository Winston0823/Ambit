-- 033_contact_card.sql — "Share contact info" chat message.
--
-- A contact card is a snapshot of the SENDER's own contact details (name,
-- .edu email, profile links) taken at send time. Stored as a jsonb column so
-- it needs no ref table, no hydration round-trip, and — critically — keeps
-- kind = 'user' so it renders as a normal bubble (not a centered system pill).
--
-- Additive + idempotent. The messages insert RLS ("sender_id = auth.uid() AND
-- caller is a participant") already covers the new column; no policy change.

alter table messages add column if not exists contact_card jsonb;
