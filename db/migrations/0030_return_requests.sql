-- Return requests from the account (PRD 12).
--
-- Returns used to be "email us". A shopper now asks from a delivered order:
-- which items and how many, why, photos for a damaged or wrong item, and what
-- they want -- a refund (and where to send it), an exchange, or store credit.
-- returns_refunds already had a row per order line; these columns carry the
-- rest. Status moves requested -> approved | rejected -> pickup_scheduled ->
-- received -> refunded | exchanged | store_credit, and the shopper is told at
-- each step.

ALTER TABLE returns_refunds ADD COLUMN order_id TEXT REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE returns_refunds ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE returns_refunds ADD COLUMN resolution TEXT NOT NULL DEFAULT 'refund';   -- refund | exchange | store_credit
ALTER TABLE returns_refunds ADD COLUMN refund_method TEXT;                          -- bkash | nagad | bank
ALTER TABLE returns_refunds ADD COLUMN refund_account TEXT;                         -- the number or account to send it to
ALTER TABLE returns_refunds ADD COLUMN photos TEXT;                                 -- JSON array of /api/media URLs

CREATE INDEX IF NOT EXISTS idx_returns_user ON returns_refunds (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns_refunds (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returns_item ON returns_refunds (order_item_id);
