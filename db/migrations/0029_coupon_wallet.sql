-- A coupon wallet (PRD 10).
--
-- Coupons could only be typed in. Now a shopper can collect one from the
-- Offers page (or by entering its code in Account > My coupons) and see it
-- under Unused, Used and Expired, and checkout lists what they hold. Holding
-- a coupon grants nothing on its own: every rule is still checked when it is
-- applied, so a collected coupon that has expired simply stops applying.
--
-- `audience` lets a coupon be for new customers only (no earlier order);
-- `is_public` decides whether it is offered on the Offers page or only works
-- for whoever has the code (an influencer's code, a Facebook post's code).

ALTER TABLE coupons ADD COLUMN audience TEXT NOT NULL DEFAULT 'all';   -- all | new_customer
ALTER TABLE coupons ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS user_coupons (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, coupon_id)
);

CREATE INDEX IF NOT EXISTS idx_user_coupons_coupon ON user_coupons (coupon_id);
