-- How much is in the database right now, table by table.
--
--   npx wrangler d1 execute zupona-v3-db --remote --file=./db/census.sql
--
-- Read-only. Run it once before taking a backup and keep the numbers: they are
-- what proves the backup is complete (db/rehearsal/check-backup.mjs reads the
-- backup file and prints the same census from it), and what proves no row was
-- lost once the migrations are done.
--
-- One row of scalar subqueries rather than a UNION of fifteen SELECTs, because
-- D1 refuses a compound SELECT past a modest number of terms.

SELECT
  (SELECT COUNT(*) FROM users)               AS users,
  (SELECT COUNT(*) FROM sellers)             AS sellers,
  (SELECT COUNT(*) FROM categories)          AS categories,
  (SELECT COUNT(*) FROM products)            AS products,
  (SELECT COUNT(*) FROM product_variants)    AS product_variants,
  (SELECT COUNT(*) FROM product_images)      AS product_images,
  (SELECT COUNT(*) FROM orders)              AS orders,
  (SELECT COUNT(*) FROM order_items)         AS order_items,
  (SELECT COUNT(*) FROM suborders)           AS suborders,
  (SELECT COUNT(*) FROM cart_items)          AS cart_items,
  (SELECT COUNT(*) FROM addresses)           AS addresses,
  (SELECT COUNT(*) FROM inventory_movements) AS inventory_movements,
  (SELECT COUNT(*) FROM notifications)       AS notifications,
  (SELECT COUNT(*) FROM reviews)             AS reviews,
  (SELECT COUNT(*) FROM site_settings)       AS site_settings;
