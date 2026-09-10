-- Key the cart on the variant instead of a display string.
--
-- cart_items was unique on (user_id, product_id, color), where `color` is the
-- text shown on the line. That makes a label the key: rename an option value in
-- the admin panel and an existing cart row no longer matches the thing it holds,
-- so adding the same variant again opens a second line. The variant id is what
-- actually identifies what is being bought.
--
-- SQLite cannot drop a table-level constraint, so the table is rebuilt. Every
-- column and every value is copied across untouched -- NULL stays NULL, nothing
-- is coerced to '' -- and the old uniqueness rule is preserved exactly for the
-- rows that predate variants, as a partial index that only applies to them.
--
-- Nothing references cart_items, so dropping it cascades nowhere. D1 applies a
-- --file atomically: if any statement fails the whole rebuild rolls back and the
-- original table is left as it was.

CREATE TABLE cart_items_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  seller_id TEXT,
  color TEXT NOT NULL DEFAULT '', -- the selection as shown on the line
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO cart_items_new (id, user_id, product_id, variant_id, seller_id, color, quantity, created_at)
SELECT id, user_id, product_id, variant_id, seller_id, color, quantity, created_at
FROM cart_items;

DROP TABLE cart_items;
ALTER TABLE cart_items_new RENAME TO cart_items;

-- One line per variant for anything added since variants existed...
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_variant_unique
  ON cart_items (user_id, product_id, variant_id) WHERE variant_id IS NOT NULL;

-- ...and, for rows that predate them, the rule they were written under.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_legacy_unique
  ON cart_items (user_id, product_id, color) WHERE variant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart_items (user_id);
