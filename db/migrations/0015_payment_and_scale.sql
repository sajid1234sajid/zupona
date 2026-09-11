-- Payment records, a complete order timeline, and the indexes the order tables
-- need once there is more than a demo's worth of rows.
--
-- `payment_transactions` has existed since 0003 and nothing has ever written to
-- it: every order carried a payment *status* on the order row and no payment
-- record at all, so there was nowhere to keep a provider reference, an amount
-- actually captured, a failure reason, or a gateway payload to reconcile
-- against. These columns make it a real payment record rather than a stub.

ALTER TABLE payment_transactions ADD COLUMN method TEXT;            -- cod|bkash|nagad|card...
ALTER TABLE payment_transactions ADD COLUMN failure_reason TEXT;
ALTER TABLE payment_transactions ADD COLUMN initiated_at TEXT;
ALTER TABLE payment_transactions ADD COLUMN completed_at TEXT;
-- The key a gateway callback is matched on. Unique, so a webhook delivered
-- twice updates one row instead of writing a second payment.
ALTER TABLE payment_transactions ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_idempotency
  ON payment_transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_order ON payment_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_provider_ref
  ON payment_transactions (provider, provider_ref);

-- The admin order list sorts by placed_at and filters on status, payment
-- status and phone. None of those had an index: every page of the list was a
-- full scan of the orders table plus a sort.
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON orders (placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (address_phone);
CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_status_history (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);
