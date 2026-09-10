-- Make placing an order, and moving it along, safe to repeat.
--
-- Three things could go wrong twice: a double-clicked checkout could write two
-- orders, a status moved back and forth could deduct stock twice, and a Buy Now
-- link could be replayed. Each gets a guarantee the application cannot bypass.
--
-- Entirely additive: no existing row is read, rewritten or removed.

-- 1. One order per checkout attempt. The key is chosen by the checkout and
--    carried on the request, so a retry lands on the row already written rather
--    than creating a second one -- along with a second reservation, a second
--    points award and a second notification. Partial, so the orders that predate
--    this (NULL) do not collide with each other.
ALTER TABLE orders ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency
  ON orders (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Where this order's stock currently stands: none | reserved | committed |
--    released | returned. It is what tells a cancellation whether to hand stock
--    back and how. Orders written before this default to 'none', which is
--    correct: nothing was ever reserved for them, so nothing is owed back.
ALTER TABLE orders ADD COLUMN stock_state TEXT NOT NULL DEFAULT 'none';

-- 3. The ledger is consulted by (reference_type, reference_id) on every status
--    change, and had no index for it.
CREATE INDEX IF NOT EXISTS idx_inventory_reference
  ON inventory_movements (reference_type, reference_id);

-- 4. The guarantee itself: one sale and one return per order per variant,
--    enforced by the database rather than by remembering to check first. A
--    second deduction cannot be written even if two requests race, because the
--    index rejects it and takes the whole batch down with it. Manual stock
--    edits carry reference_type 'manual' and are outside this index entirely.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_order_once
  ON inventory_movements (reference_id, variant_id, reason)
  WHERE reference_type = 'order' AND reason IN ('sale', 'return');

-- 5. A Buy Now session is spent once. Without this the same session could be
--    replayed into a second order.
ALTER TABLE buy_now_sessions ADD COLUMN consumed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_buy_now_expiry ON buy_now_sessions (expires_at);
