-- Free delivery becomes a per-product choice.
--
-- Until now delivery was decided for the whole shop: one fee in
-- `site_settings.delivery_fee`, waived once an order's subtotal reached
-- `free_shipping_threshold`. There was no way to say "this one ships free"
-- without lowering the threshold for the entire catalogue, so an admin who
-- wanted to promote a single product had to ask for a code change instead.
--
-- `free_delivery = 1` means an order made up entirely of such products is
-- delivered at no charge, whatever the subtotal. A cart that also holds an
-- ordinary product is priced by the shop-wide rule exactly as before: one
-- ৳50 item added alongside must not buy free delivery for the rest, and the
-- order carries a single `shipping_fee` with nothing per-line to split.
--
-- Default 0, and no UPDATE afterwards, so every product that exists today
-- keeps charging what it charges now and nothing on the storefront changes
-- until an admin turns the flag on for a product deliberately.

ALTER TABLE products ADD COLUMN free_delivery INTEGER NOT NULL DEFAULT 0;
