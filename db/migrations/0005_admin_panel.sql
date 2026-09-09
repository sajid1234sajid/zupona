-- Admin panel support.
--
-- Two additions, both driven by the admin dashboard:
--
-- 1. `reviews.status` -- the moderation queue needs four states (approved,
--    pending, rejected, spam), where `is_approved` only carried two. The old
--    column stays and remains the thing storefront queries filter on, so
--    nothing customer-facing changes; `status` is the richer editorial view
--    and the two are kept in step by src/lib/reviews.ts.
--
-- 2. `banners` -- homepage merchandising slots that the marketing page edits
--    without a deploy. Previously the home page's banners were hardcoded in
--    src/data/, which meant a code change to run a campaign.

ALTER TABLE reviews ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';

-- Bring existing rows in line with the column they were moderated through.
UPDATE reviews SET status = CASE WHEN is_approved = 1 THEN 'approved' ELSE 'pending' END;

CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews (status);

CREATE TABLE IF NOT EXISTS banners (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  -- Where on the storefront the banner renders.
  placement TEXT NOT NULL DEFAULT 'hero', -- hero|promo|discover
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_banners_placement ON banners (placement, sort_order);
