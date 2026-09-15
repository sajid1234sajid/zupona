-- Names the `baby-products` department "Baby Products" again.
--
-- 0007 renamed it "Baby Accessories" to match the homepage reference of the
-- time; the home page's featured department tiles now call it Baby Products.
-- Only the display name changes: the id and slug stay `baby-products`, so every
-- product, order line and saved link that points at it keeps working.
--
-- A single idempotent UPDATE, so re-running this file is safe.

UPDATE categories SET name = 'Baby Products' WHERE id = 'baby-products';
