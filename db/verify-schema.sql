-- Schema parity check.
--
-- Answers one question: does this database carry everything the application
-- expects? Every row comes back ok = 1 on a fully migrated database; any row
-- with ok = 0 names exactly what is missing.
--
--   node db/run-query.mjs db/verify-schema.sql --local
--   node db/run-query.mjs db/verify-schema.sql
--
-- Not `wrangler d1 execute --file`, which runs a file but returns no rows.
--
-- Read-only. It queries sqlite_master and pragma_table_info and changes
-- nothing, so it is safe against production at any time -- including before a
-- migration, to see what is not there yet.
--
-- The expected list is one JSON array walked by json_each rather than a VALUES
-- list, because a VALUES list compiles to a compound SELECT with one term per
-- row and D1 refuses those past a modest number of terms.

WITH expected AS (
  SELECT json_extract(value, '$[0]') AS mig,
         json_extract(value, '$[1]') AS kind,
         json_extract(value, '$[2]') AS tbl,
         json_extract(value, '$[3]') AS nm
  FROM json_each('[
    ["0009","tbl","","product_option_groups"],
    ["0009","tbl","","product_option_values"],
    ["0009","tbl","","product_variant_options"],
    ["0009","tbl","","buy_now_sessions"],
    ["0009","col","product_variants","image_id"],
    ["0009","col","products","short_description"],
    ["0009","col","products","badge_label"],
    ["0009","col","products","return_policy"],
    ["0009","col","products","warranty"],
    ["0009","col","product_features","value"],
    ["0009","col","product_images","alt"],
    ["0009","col","product_videos","alt"],
    ["0009","idx","","idx_option_groups_product"],
    ["0009","idx","","idx_option_values_group"],
    ["0009","idx","","idx_variant_options_value"],
    ["0009","idx","","idx_buy_now_user"],
    ["0010","idx","","idx_cart_variant_unique"],
    ["0010","idx","","idx_cart_legacy_unique"],
    ["0011","col","orders","idempotency_key"],
    ["0011","col","orders","stock_state"],
    ["0011","col","buy_now_sessions","consumed_at"],
    ["0011","idx","","idx_orders_idempotency"],
    ["0011","idx","","idx_inventory_reference"],
    ["0011","idx","","idx_inventory_order_once"],
    ["0011","idx","","idx_buy_now_expiry"],
    ["0012","idx","","idx_order_items_suborder"],
    ["0012","idx","","idx_order_items_seller"],
    ["0013","col","product_option_groups","is_active"],
    ["0013","col","product_option_values","is_active"],
    ["0013","col","product_variants","option_signature"],
    ["0013","idx","","idx_variant_combination"],
    ["0014","col","orders","address_district"],
    ["0014","col","addresses","district"],
    ["0015","col","payment_transactions","method"],
    ["0015","col","payment_transactions","failure_reason"],
    ["0015","col","payment_transactions","initiated_at"],
    ["0015","col","payment_transactions","completed_at"],
    ["0015","col","payment_transactions","idempotency_key"],
    ["0015","idx","","idx_payment_idempotency"],
    ["0015","idx","","idx_payment_order"],
    ["0015","idx","","idx_payment_provider_ref"],
    ["0015","idx","","idx_orders_placed_at"],
    ["0015","idx","","idx_orders_status"],
    ["0015","idx","","idx_orders_payment_status"],
    ["0015","idx","","idx_orders_number"],
    ["0015","idx","","idx_orders_phone"],
    ["0015","idx","","idx_order_history_order"],
    ["0015","idx","","idx_notifications_user"]
  ]')
)
SELECT mig AS migration,
       CASE kind WHEN 'col' THEN tbl || '.' || nm
                 WHEN 'tbl' THEN 'table ' || nm
                 ELSE 'index ' || nm END AS expects,
       CASE kind
         WHEN 'col' THEN (SELECT COUNT(*) FROM pragma_table_info(tbl) WHERE name = nm)
         WHEN 'tbl' THEN (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = nm)
         ELSE            (SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = nm)
       END AS ok
FROM expected
ORDER BY mig, kind, tbl, nm;
