-- Richer reviews, and a points ledger.
--
-- Reviews (PRD 07): a reviewer can now say how an item fits, pick up to three
-- short tags ("Good quality", "Value for money"), and add photos (already
-- stored in review_images). A review that earned points is marked
-- `incentivized` so the page can label it "Rewarded review", the disclosure
-- an honest shop owes its readers. "Helpful" becomes one vote per shopper,
-- recorded in review_votes, instead of a counter anyone could press forever.
--
-- Points (PRD 11): users.points was a single number, raised when an order was
-- placed and adjusted by hand in the admin panel, with no record of why. The
-- ledger records every change -- an order, a review, a redemption, an
-- adjustment -- and users.points stays as the cached sum of it, always
-- written in the same batch as the ledger row. The backfill turns today's
-- balances into ledger rows: one per order that earned points, plus one
-- "adjust" row for whatever the admin panel added or took away, so every
-- balance is unchanged by this migration.

ALTER TABLE reviews ADD COLUMN fit TEXT;            -- small | true | large, apparel only
ALTER TABLE reviews ADD COLUMN tags TEXT;           -- JSON array of up to 3 tag ids
ALTER TABLE reviews ADD COLUMN incentivized INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS review_votes (
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (review_id, user_id)
);

CREATE TABLE IF NOT EXISTS points_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,                           -- positive earns, negative spends or reverses
  reason TEXT NOT NULL,                             -- order|review|signup|redeem|reverse|expire|adjust
  ref_id TEXT,                                      -- the order, review or admin action it belongs to
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON points_ledger (user_id, created_at DESC);
-- One entry per reason per thing: an order earns once, a review once, a
-- redemption once. Re-running a write is then a no-op rather than a double.
CREATE UNIQUE INDEX IF NOT EXISTS idx_points_ledger_once ON points_ledger (user_id, reason, ref_id);

INSERT OR IGNORE INTO points_ledger (id, user_id, delta, reason, ref_id, created_at)
SELECT 'order-' || o.id, o.user_id, o.points_earned, 'order', o.id, o.placed_at
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.points_earned > 0;

INSERT OR IGNORE INTO points_ledger (id, user_id, delta, reason, ref_id, note)
SELECT 'adjust-0027-' || u.id, u.id,
       u.points - COALESCE((SELECT SUM(l.delta) FROM points_ledger l WHERE l.user_id = u.id), 0),
       'adjust', 'migration-0027', 'Balance before the points ledger'
FROM users u
WHERE u.points != COALESCE((SELECT SUM(l.delta) FROM points_ledger l WHERE l.user_id = u.id), 0);
