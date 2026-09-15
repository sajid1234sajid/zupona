-- Read-only preflight for the migrations the remote database has not had.
--
-- Production runs the code on `main`, which carries migrations 0001..0008.
-- 0009 onwards have never been deployed, so the option tables do not exist
-- there. Every statement below is a SELECT, and none of them touches a table
-- 0009 creates -- Q1 is what establishes where the database actually stands.
--
--   node db/run-query.mjs db/preflight.sql
--
-- or paste them one at a time into the D1 console. Not `wrangler d1 execute
-- --file`, which runs a file but returns no rows.

-- ---------------------------------------------------------------------------
-- 1. Which migration has the database reached? Tables, by the one that makes
--    them. The first row that reads `MISSING` is where it stopped.
-- ---------------------------------------------------------------------------
WITH expected(mig, tbl) AS (VALUES
  ('0001', 'orders'),                  ('0001', 'order_items'),
  ('0001', 'cart_items'),              ('0001', 'notifications'),
  ('0002', 'phone_verifications'),     ('0003', 'sellers'),
  ('0003', 'products'),                ('0003', 'product_variants'),
  ('0003', 'suborders'),               ('0003', 'payment_transactions'),
  ('0003', 'site_settings'),           ('0005', 'banners'),
  ('0008', 'product_videos'),          ('0009', 'product_option_groups'),
  ('0009', 'product_option_values'),   ('0009', 'product_variant_options'),
  ('0009', 'buy_now_sessions')
)
SELECT mig AS migration, tbl AS table_name,
       CASE WHEN (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = tbl) > 0
            THEN 'present' ELSE 'MISSING' END AS state
FROM expected
ORDER BY mig, tbl;

-- ---------------------------------------------------------------------------
-- 2. Columns the pending migrations add. Only tables that exist at 0008.
-- ---------------------------------------------------------------------------
WITH expected(mig, tbl, col) AS (VALUES
  ('0009', 'product_variants',     'image_id'),
  ('0009', 'products',             'short_description'),
  ('0009', 'products',             'badge_label'),
  ('0009', 'products',             'return_policy'),
  ('0009', 'products',             'warranty'),
  ('0009', 'product_images',       'alt'),
  ('0011', 'orders',               'idempotency_key'),
  ('0011', 'orders',               'stock_state'),
  ('0013', 'product_variants',     'option_signature'),
  ('0014', 'orders',               'address_district'),
  ('0014', 'addresses',            'district'),
  ('0015', 'payment_transactions', 'method'),
  ('0015', 'payment_transactions', 'failure_reason'),
  ('0015', 'payment_transactions', 'initiated_at'),
  ('0015', 'payment_transactions', 'completed_at'),
  ('0015', 'payment_transactions', 'idempotency_key')
)
SELECT mig AS migration, tbl || '.' || col AS column_name,
       CASE WHEN (SELECT COUNT(*) FROM pragma_table_info(tbl) WHERE name = col) > 0
            THEN 'already applied' ELSE 'not yet' END AS state
FROM expected
ORDER BY mig, tbl, col;

-- ---------------------------------------------------------------------------
-- 3. Indexes they add.
-- ---------------------------------------------------------------------------
WITH expected(mig, nm) AS (VALUES
  ('0009', 'idx_option_groups_product'),  ('0009', 'idx_buy_now_user'),
  ('0010', 'idx_cart_variant_unique'),    ('0010', 'idx_cart_legacy_unique'),
  ('0011', 'idx_orders_idempotency'),     ('0011', 'idx_inventory_reference'),
  ('0011', 'idx_inventory_order_once'),   ('0011', 'idx_buy_now_expiry'),
  ('0012', 'idx_order_items_suborder'),   ('0012', 'idx_order_items_seller'),
  ('0013', 'idx_variant_combination'),    ('0015', 'idx_payment_idempotency'),
  ('0015', 'idx_payment_order'),          ('0015', 'idx_payment_provider_ref'),
  ('0015', 'idx_orders_placed_at'),       ('0015', 'idx_orders_status'),
  ('0015', 'idx_orders_payment_status'),  ('0015', 'idx_orders_number'),
  ('0015', 'idx_orders_phone'),           ('0015', 'idx_order_history_order'),
  ('0015', 'idx_notifications_user')
)
SELECT mig AS migration, nm AS index_name,
       CASE WHEN (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = nm) > 0
            THEN 'already applied' ELSE 'not yet' END AS state
FROM expected
ORDER BY mig, nm;

-- ---------------------------------------------------------------------------
-- 4. 0010 rebuilds cart_items: how many lines have to survive the copy.
-- ---------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM cart_items) AS cart_lines_to_copy,
  (SELECT COUNT(*) FROM cart_items WHERE variant_id IS NOT NULL) AS lines_chosen_by_variant,
  (SELECT COUNT(*) FROM cart_items WHERE variant_id IS NULL) AS lines_chosen_by_colour_only,
  (SELECT COUNT(*) FROM (SELECT user_id FROM cart_items WHERE variant_id IS NOT NULL
                          GROUP BY user_id, product_id, variant_id HAVING COUNT(*) > 1)) AS duplicate_variant_lines,
  (SELECT COUNT(*) FROM (SELECT user_id FROM cart_items WHERE variant_id IS NULL
                          GROUP BY user_id, product_id, color HAVING COUNT(*) > 1)) AS duplicate_colour_lines;

-- ---------------------------------------------------------------------------
-- 5. How much work 0012 has to do, and on what.
-- ---------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM orders) AS orders_total,
  (SELECT COUNT(*) FROM orders o
    WHERE NOT EXISTS (SELECT 1 FROM suborders s WHERE s.order_id = o.id)) AS suborders_to_create,
  (SELECT COUNT(*) FROM suborders) AS suborders_now,
  (SELECT COUNT(*) FROM order_items WHERE suborder_id IS NULL) AS lines_to_attach,
  (SELECT COUNT(*) FROM order_items WHERE seller_id IS NULL) AS lines_to_stamp_with_a_seller,
  (SELECT COUNT(*) FROM order_items oi
    WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = oi.product_id)) AS lines_whose_product_is_gone,
  (SELECT COUNT(*) FROM (SELECT order_id FROM suborders GROUP BY order_id HAVING COUNT(*) > 1)) AS orders_already_split;

-- ---------------------------------------------------------------------------
-- 6. Can 0013's unique index be created? THE ONE THAT DECIDES.
-- ---------------------------------------------------------------------------
--
-- 0013 makes (product_id, option_signature) unique over active variants, and
-- rolls the whole file back if two of them collide. At the 0008 schema every
-- signature will be derived from the legacy slots, because that is all 0009
-- has to work from -- so the combination is the pair of (slugified option
-- name, value), whichever slot each happens to sit in. Two active variants of
-- one product with no options at all collide too: both sign the empty string.
--
-- Every row this returns will stop 0013. Zero rows means it can be applied.

WITH v(id, product_id, k1, k2) AS (
  SELECT id, product_id,
         CASE WHEN option1_value IS NOT NULL AND option1_name IS NOT NULL
              THEN replace(lower(option1_name), ' ', '-') || '=' || option1_value END,
         CASE WHEN option2_value IS NOT NULL AND option2_name IS NOT NULL
              THEN replace(lower(option2_name), ' ', '-') || '=' || option2_value END
    FROM product_variants
   WHERE is_active = 1
),
sig(id, product_id, s) AS (
  SELECT id, product_id,
         CASE WHEN k1 IS NULL AND k2 IS NULL THEN ''
              WHEN k2 IS NULL THEN k1
              WHEN k1 IS NULL THEN k2
              ELSE min(k1, k2) || '|' || max(k1, k2) END
    FROM v
)
SELECT p.name AS product,
       CASE WHEN sig.s = '' THEN '(no options)' ELSE sig.s END AS combination,
       COUNT(*) AS active_variants,
       group_concat(sig.id, ', ') AS variant_ids
FROM sig
JOIN products p ON p.id = sig.product_id
GROUP BY sig.product_id, sig.s
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ---------------------------------------------------------------------------
-- 7. What 0009 will build out of the legacy slots.
-- ---------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM products) AS products_total,
  (SELECT COUNT(*) FROM product_variants) AS variants_total,
  (SELECT COUNT(*) FROM product_variants WHERE is_active = 1) AS variants_active,
  (SELECT COUNT(*) FROM (SELECT product_id FROM product_variants
                          WHERE option1_value IS NOT NULL AND option1_name IS NOT NULL
                          GROUP BY product_id, option1_name)) AS groups_from_option1,
  (SELECT COUNT(*) FROM (SELECT product_id FROM product_variants
                          WHERE option2_value IS NOT NULL AND option2_name IS NOT NULL
                          GROUP BY product_id, option2_name)) AS groups_from_option2,
  (SELECT COUNT(*) FROM product_variants
    WHERE option1_value IS NULL AND option2_value IS NULL) AS variants_with_no_options,
  (SELECT COUNT(*) FROM product_variants
    WHERE option1_value IS NULL AND option2_value IS NOT NULL) AS variants_using_slot_two_only;
