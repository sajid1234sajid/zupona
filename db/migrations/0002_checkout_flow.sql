-- One-time migration for the 3-step checkout flow (delivery method, the
-- division/thana breakdown shown on the confirmation screen, and the original
-- price needed for the "you save" line on order items). Run once per database:
--   npx wrangler d1 execute zupona-db --local --file=./db/migrations/0002_checkout_flow.sql
--   npx wrangler d1 execute zupona-db --remote --file=./db/migrations/0002_checkout_flow.sql
-- New installs don't need this -- db/schema.sql already includes it all.

ALTER TABLE orders ADD COLUMN delivery_method TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE orders ADD COLUMN address_area TEXT;
ALTER TABLE orders ADD COLUMN address_city TEXT NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN old_price INTEGER NOT NULL DEFAULT 0;

-- Phone codes for the checkout verification step. The row id is the only thing
-- that ever reaches the browser (in an httpOnly cookie), so a visitor cannot
-- forge a "verified" state by editing their own cookie.
CREATE TABLE IF NOT EXISTS phone_verifications (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications (phone);
