-- Give every order the fulfilment structure it always needed.
--
-- `suborders` has existed since the marketplace schema was laid down, and the
-- admin panel already writes courier and tracking details into it -- but the
-- table was never populated, so those writes hit nothing. An admin could type a
-- tracking number, press Save, watch the page reload and have nothing saved.
--
-- One suborder per seller in an order, and exactly one for an order that is
-- entirely platform-owned. Not a special case for single-seller orders: two
-- shapes would mean two fulfilment code paths, and the day a real seller
-- appears every existing order would need reshaping.
--
-- Entirely additive. Existing rows keep every value they have; the backfill
-- only inserts suborders and fills columns that are NULL.

-- 1. The joins this introduces, which had no index.
CREATE INDEX IF NOT EXISTS idx_order_items_suborder ON order_items (suborder_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items (seller_id);

-- 2. One platform suborder for each order that has none. Its status is the
--    order's own, so the timeline reads exactly as it did before -- the
--    suborder mirrors the order and never leads it.
INSERT INTO suborders (id, order_id, seller_id, status, subtotal, shipping_fee, commission_amount)
SELECT lower(hex(randomblob(16))),
       o.id,
       NULL, -- platform-owned: every product predating this is
       o.status,
       (SELECT COALESCE(SUM(oi.price * oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id),
       o.shipping_fee, -- a single suborder carries the whole delivery charge
       0 -- no commission is owed on the platform's own goods
FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM suborders s WHERE s.order_id = o.id);

-- 3. Attach the lines to it, but only where the order ended up with exactly one
--    suborder and the line is not already attached to something. An order that
--    already had suborders is left alone entirely.
UPDATE order_items
SET suborder_id = (SELECT s.id FROM suborders s WHERE s.order_id = order_items.order_id)
WHERE suborder_id IS NULL
  AND (SELECT COUNT(*) FROM suborders s WHERE s.order_id = order_items.order_id) = 1;

-- 4. Record who sold each line. Today every product is the platform's, so this
--    writes NULL over NULL and changes nothing -- but it establishes the rule,
--    and from here the seller is snapshotted at the moment of sale rather than
--    looked up later, so moving a product to a different seller never rewrites
--    the history of orders already placed.
UPDATE order_items
SET seller_id = (SELECT p.seller_id FROM products p WHERE p.id = order_items.product_id)
WHERE seller_id IS NULL;
