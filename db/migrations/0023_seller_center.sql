-- The Seller Center's money trail.
--
-- A payout is money the platform sends outside this system -- a bKash or
-- Nagad send, a bank transfer -- and the admin records it here once it has
-- gone. Without the transfer's own reference the seller has a row saying
-- "paid ৳4,200" and nothing to match it against on their phone or statement,
-- which is the first support message every payout would produce.
--
-- The second index serves the Seller Center's order screens and every
-- balance figure, which all filter one store's suborders by status.

ALTER TABLE seller_payouts ADD COLUMN reference TEXT;

CREATE INDEX IF NOT EXISTS idx_suborders_seller_status
  ON suborders (seller_id, status);
