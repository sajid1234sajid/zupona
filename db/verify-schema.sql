-- Schema parity check.
--
-- Answers one question: does this database carry everything the application
-- expects? Every row comes back ok = 1 on a fully migrated database; any row
-- with ok = 0 names exactly what is missing.
--
--   npx wrangler d1 execute zupona-v3-db --local  --file=./db/verify-schema.sql
--   npx wrangler d1 execute zupona-v3-db --remote --file=./db/verify-schema.sql
--
-- Read-only. It queries sqlite_master and pragma_table_info and changes
-- nothing, so it is safe against production at any time -- including before a
-- migration, to see what is not there yet.

WITH expected(kind, tbl, nm) AS (
  VALUES
    ('col', 'orders', 'address_district'),
    ('col', 'addresses', 'district'),
    ('col', 'payment_transactions', 'method'),
    ('col', 'payment_transactions', 'failure_reason'),
    ('col', 'payment_transactions', 'initiated_at'),
    ('col', 'payment_transactions', 'completed_at'),
    ('col', 'payment_transactions', 'idempotency_key'),
    ('col', 'orders', 'idempotency_key'),
    ('col', 'product_variants', 'option_signature'),
    ('idx', '', 'idx_payment_idempotency'),
    ('idx', '', 'idx_payment_order'),
    ('idx', '', 'idx_payment_provider_ref'),
    ('idx', '', 'idx_orders_placed_at'),
    ('idx', '', 'idx_orders_status'),
    ('idx', '', 'idx_orders_payment_status'),
    ('idx', '', 'idx_orders_number'),
    ('idx', '', 'idx_orders_phone'),
    ('idx', '', 'idx_order_history_order'),
    ('idx', '', 'idx_notifications_user')
)
SELECT
  CASE e.kind WHEN 'col' THEN e.tbl || '.' || e.nm ELSE 'index ' || e.nm END AS expects,
  CASE e.kind
    WHEN 'col' THEN (SELECT COUNT(*) FROM pragma_table_info(e.tbl) WHERE name = e.nm)
    ELSE (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = e.nm)
  END AS ok
FROM expected e;
