-- 0004: record the price a product was at when it was saved.
--
-- Without this the wishlist can only show today's price, so it cannot answer
-- the question shoppers actually open the page for: "has it got cheaper since
-- I saved it?". `saved_price` is written once, at insert, and never updated —
-- the drop is computed as (saved_price - current price) at read time.
--
-- Nullable on purpose: rows saved before this migration have no baseline and
-- simply show no price-drop badge, which is honest. It also sidesteps
-- SQLite's refusal to ADD COLUMN with a non-constant default.
--
-- Run once per existing database:
--   npx wrangler d1 execute zupona-v3-db --local  --file=./db/migrations/0004_wishlist_saved_price.sql
--   npx wrangler d1 execute zupona-v3-db --remote --file=./db/migrations/0004_wishlist_saved_price.sql

ALTER TABLE wishlist_items ADD COLUMN saved_price INTEGER;

-- Wishlist reads are always "this user's saved items, newest first"; the
-- existing idx_wishlist_user_id covers the filter but not the ordering.
CREATE INDEX IF NOT EXISTS idx_wishlist_user_created ON wishlist_items (user_id, created_at DESC);
