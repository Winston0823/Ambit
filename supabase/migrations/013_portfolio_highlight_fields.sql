-- ============================================================
-- 013_portfolio_highlight_fields.sql · Enrich portfolio highlights
-- with the Mobbin-informed fields: a timeframe ("2025" / "Spring
-- 2025"), role/contribution bullets, one external link, and
-- tool/tech tags. All additive + nullable/defaulted so existing
-- rows stay valid (timeframe is required only at the editor level).
-- ============================================================

alter table portfolio_items
  add column if not exists timeframe     text,
  add column if not exists contributions text[] not null default '{}',
  add column if not exists link_url      text,
  add column if not exists tools         text[] not null default '{}';
