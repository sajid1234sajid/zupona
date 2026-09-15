-- Read-only preflight for migrations 0011..0015.
--
-- Answers two questions the table list cannot: which of these migrations have
-- already run, and whether the data they will touch can survive them. Every
-- statement is a SELECT. Nothing is created, altered, inserted or deleted.
--
--   npx wrangler d1 execute zupona-v3-db --remote --file=./db/preflight.sql
--
-- or paste them one at a time into the D1 console. Query 4 is the one that
-- matters: it predicts, before the column exists, whether 0013's unique index
-- can be created. Verified against db/rehearsal to reproduce what 0013
-- actually computes.

-- ---------------------------------------------------------------------------
-- 1. Which columns these migrations add, and whether they are there yet.
-- ---------------------------------------------------------------------------
WITH expected(mig, tbl, col) AS (VALUES
  ('0011', 'orders',                'idempotency_key'),
  ('0011', 'orders',                'stock_state'),
  ('0011', 'buy_now_sessions',      'consumed_at'),
  ('0013', 'product_option_groups', 'is_active'),
  ('0013', 'product_option_values', 'is_active'),
  ('0013', 'product_variants',      'option_signature'),
  ('0014', 'orders',                'address_district'),
  ('0014', 'addresses',             'district'),
  ('0015', 'payment_transactions',  'method'),
  ('0015', 'payment_transactions',  'failure_reason'),
  ('0015', 'payment_transactions',  'initiated_at'),
  ('0015', 'payment_transactions',  'completed_at'),
  ('0015', 'payment_transactions',  'idempotency_key')
)
SELECT mig AS migration,
       tbl || '.' || col AS column_name,
       CASE WHEN (SELECT COUNT(*) FROM pragma_table_info(tbl) WHERE name = col) > 0
            THEN 'already applied' ELSE 'not yet' END AS state
FROM expected
ORDER BY mig, tbl, col;

-- ---------------------------------------------------------------------------
-- 2. The indexes they add.
-- ---------------------------------------------------------------------------
WITH expected(mig, nm) AS (VALUES
  ('0011', 'idx_orders_idempotency'),
  ('0011', 'idx_inventory_reference'),
  ('0011', 'idx_inventory_order_once'),
  ('0011', 'idx_buy_now_expiry'),
  ('0012', 'idx_order_items_suborder'),
  ('0012', 'idx_order_items_seller'),
  ('0013', 'idx_variant_combination'),
  ('0015', 'idx_payment_idempotency'),
  ('0015', 'idx_payment_order'),
  ('0015', 'idx_payment_provider_ref'),
  ('0015', 'idx_orders_placed_at'),
  ('0015', 'idx_orders_status'),
  ('0015', 'idx_orders_payment_status'),
  ('0015', 'idx_orders_number'),
  ('0015', 'idx_orders_phone'),
  ('0015', 'idx_order_history_order'),
  ('0015', 'idx_notifications_user')
)
SELECT mig AS migration, nm AS index_name,
       CASE WHEN (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = nm) > 0
            THEN 'already applied' ELSE 'not yet' END AS state
FROM expected
ORDER BY mig, nm;

-- ---------------------------------------------------------------------------
-- 3. How much work 0012 has to do, and on what.
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
-- 4. Can 0013's unique index be created? THE ONE THAT DECIDES.
-- ---------------------------------------------------------------------------
--
-- 0013 flattens each variant's options into `<group key>=<value id>` pairs and
-- then makes (product_id, option_signature) unique over active variants. The
-- column does not exist yet, so this rebuilds the same set from what is there:
-- the canonical links, plus each legacy option1/option2 slot resolved to the
-- group it will land in. Value ids are minted by the migration, so labels stand
-- in for them -- a value is identified by (group, label), which is exactly what
-- 0013 matches on.
--
-- Every row this returns is a collision that will stop 0013 and roll it back.
-- Zero rows means the index can be created.

WITH pairs(vid, k, lb) AS (
  SELECT o.variant_id, g.key, ov.label
    FROM product_variant_options o
    JOIN product_option_groups g  ON g.id = o.group_id
    JOIN product_option_values ov ON ov.id = o.value_id
  UNION
  SELECT pv.id,
         COALESCE((SELECT g.key FROM product_option_groups g
                    WHERE g.product_id = pv.product_id AND g.name = pv.option1_name),
                  replace(lower(pv.option1_name), ' ', '-')),
         pv.option1_value
    FROM product_variants pv
   WHERE pv.option1_value IS NOT NULL AND pv.option1_name IS NOT NULL
  UNION
  SELECT pv.id,
         COALESCE((SELECT g.key FROM product_option_groups g
                    WHERE g.product_id = pv.product_id AND g.name = pv.option2_name),
                  replace(lower(pv.option2_name), ' ', '-')),
         pv.option2_value
    FROM product_variants pv
   WHERE pv.option2_value IS NOT NULL AND pv.option2_name IS NOT NULL
),
sig(id, product_id, s) AS (
  SELECT pv.id, pv.product_id,
         COALESCE((SELECT group_concat(k || '=' || lb, '|' ORDER BY k)
                     FROM pairs WHERE vid = pv.id), '')
    FROM product_variants pv
   WHERE pv.is_active = 1
)
SELECT p.name AS product,
       CASE WHEN sig.s = '' THEN '(no options)' ELSE sig.s END AS combination,
       COUNT(*) AS active_variants,
       group_concat(COALESCE(sig.id, ''), ', ') AS variant_ids
FROM sig
JOIN products p ON p.id = sig.product_id
GROUP BY sig.product_id, sig.s
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ---------------------------------------------------------------------------
-- 5. What 0013 will build, and the case that used to break it.
-- ---------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM product_variants) AS variants_total,
  (SELECT COUNT(*) FROM product_variants WHERE is_active = 1) AS variants_active,
  (SELECT COUNT(*) FROM product_option_groups) AS option_groups_now,
  (SELECT COUNT(*) FROM product_variant_options) AS variant_links_now,
  (SELECT COUNT(*) FROM product_variants pv
    WHERE pv.option1_value IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM product_variant_options o WHERE o.variant_id = pv.id)) AS legacy_variants_to_convert,
  (SELECT COUNT(*) FROM product_variants pv
    WHERE pv.option1_value IS NULL AND pv.option2_value IS NULL
      AND EXISTS (SELECT 1 FROM product_variant_options o
                  JOIN product_option_groups g ON g.id = o.group_id
                  WHERE o.variant_id = pv.id AND g.key = 'color')) AS variants_to_mirror_into_legacy,
  (SELECT COUNT(*) FROM product_option_groups
    WHERE key <> replace(lower(name), ' ', '-')) AS renamed_groups_the_0013_fix_protects;
