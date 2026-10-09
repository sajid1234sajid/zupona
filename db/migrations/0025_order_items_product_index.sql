-- Product cards now say how many of a product have sold ("1.2K+ sold").
--
-- That figure is counted from `order_items`, the same way the product page
-- already counts it, because `products.sold_count` is only written when stock
-- is committed and lags behind what shoppers have actually ordered. Every
-- catalog read and every add-to-cart lookup now sums it per product, and
-- `order_items` had indexes on its order, suborder and seller but none on the
-- product -- so each sum walked the whole table.
--
-- Index only: no column changes, and the code works the same whether or not
-- this has been applied. It is only slower without it.

CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);
