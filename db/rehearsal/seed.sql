-- Data shaped the way production's is at the 0008 schema: variants carry
-- options in the two fixed `option1_*` / `option2_*` slots only, because the
-- canonical option tables do not exist yet; orders have no suborders; cart
-- lines predate the variant-aware cart.

INSERT INTO users (id, name, email, phone, role) VALUES
  ('u1', 'Sajid Rahman', 'sajid@example.com', '01711000001', 'customer'),
  ('u2', 'Nadia Traders', 'nadia@example.com', '01711000002', 'seller');

INSERT INTO sellers (id, user_id, store_name, slug, status, commission_rate)
VALUES ('s1', 'u2', 'Nadia Traders', 'nadia-traders', 'approved', 12.0);

INSERT INTO categories (id, name, slug) VALUES ('c1', 'General', 'general');

INSERT INTO products (id, seller_id, category_id, name, slug, price) VALUES
  ('p1', NULL, 'c1', 'Classic Watch',  'classic-watch',  3500),
  ('p2', 's1', 'c1', 'Runner Shoe',    'runner-shoe',    2400),
  ('p3', NULL, 'c1', 'Face Serum',     'face-serum',      900),
  ('p4', NULL, 'c1', 'Leather Wallet', 'leather-wallet', 5200),
  ('p5', NULL, 'c1', 'Cotton Socks',   'cotton-socks',    450);

INSERT INTO product_images (id, product_id, url, sort_order) VALUES
  ('img1', 'p1', '/a.jpg', 0);

-- p1: one colour group, with swatches.       p2: colour and size together.
-- p3: a group that is neither colour nor size, so 0013 must not mirror it.
-- p4: a colour group with no swatch at all.  p5: a variant with no options.
INSERT INTO product_variants (id, product_id, sku, option1_name, option1_value, option2_name, option2_value, swatch, price, stock_quantity) VALUES
  ('v1', 'p1', 'CW-BG',  'Color',  'Black & Gold', NULL,   NULL, '#111111', NULL, 10),
  ('v2', 'p1', 'CW-SL',  'Color',  'Silver',       NULL,   NULL, '#cccccc', 3700,  4),
  ('v3', 'p2', 'RS-R42', 'Color',  'Red',          'Size', '42', '#dd2222', NULL,  6),
  ('v4', 'p2', 'RS-R43', 'Color',  'Red',          'Size', '43', '#dd2222', NULL,  3),
  ('v5', 'p3', 'FS-30',  'Volume', '30 ml',        NULL,   NULL, NULL,      NULL, 12),
  ('v6', 'p3', 'FS-50',  'Volume', '50 ml',        NULL,   NULL, NULL,      NULL,  7),
  ('v7', 'p4', 'LW-MB',  'Color',  'Midnight Blue',NULL,   NULL, NULL,      NULL,  5),
  ('v8', 'p5', 'CS-1',   NULL,     NULL,           NULL,   NULL, NULL,      NULL, 40);

-- Cart lines as the pre-0010 table holds them: one chosen by variant, one by
-- colour alone, and one belonging to a second shopper.
INSERT INTO cart_items (id, user_id, product_id, variant_id, seller_id, color, quantity) VALUES
  ('ci1', 'u1', 'p1', 'v1',  NULL, 'Black & Gold', 1),
  ('ci2', 'u1', 'p5', NULL,  NULL, '',             3),
  ('ci3', 'u2', 'p2', 'v3',  's1', 'Red',          2);

-- Orders written before suborders were ever populated.
INSERT INTO orders (id, order_number, user_id, status, payment_status, subtotal, shipping_fee, total,
                    address_label, address_full_name, address_phone, address_line, address_area, address_city,
                    payment_label, placed_at) VALUES
  ('o1', 'ZUP-1001', 'u1', 'delivered', 'paid',    10900, 60, 10960, 'Home', 'Sajid Rahman', '01711000001', 'House 12, Road 3', 'Cumilla Sadar Dakshin', 'Chattogram', 'Cash on Delivery', '2026-08-01 10:00:00'),
  ('o2', 'ZUP-1002', 'u1', 'shipped',   'pending',  2400, 80,  2480, 'Home', 'Sajid Rahman', '01711000001', 'House 12, Road 3', 'Cumilla Sadar Dakshin', 'Chattogram', 'Cash on Delivery', '2026-08-05 11:00:00'),
  ('o3', 'ZUP-1003', 'u1', 'confirmed', 'paid',     3500, 60,  3560, 'Home', 'Sajid Rahman', '01711000001', 'House 12, Road 3', 'Kotwali',              'Chattogram', 'Cash on Delivery', '2026-08-09 12:00:00'),
  ('o4', 'ZUP-1004', 'u1', 'cancelled', 'pending',     0, 60,    60, 'Home', 'Sajid Rahman', '01711000001', 'House 12, Road 3', 'Kotwali',              'Chattogram', 'Cash on Delivery', '2026-08-11 13:00:00');

INSERT INTO order_items (id, order_id, product_id, variant_id, seller_id, suborder_id, name, image, color, price, quantity) VALUES
  ('i1', 'o1', 'p1', 'v1', NULL, NULL, 'Classic Watch', '/a.jpg', 'Black & Gold', 3500, 1),
  ('i2', 'o1', 'p1', 'v2', NULL, NULL, 'Classic Watch', '/a.jpg', 'Silver',       3700, 2),
  ('i3', 'o2', 'p2', 'v3', NULL, NULL, 'Runner Shoe',   '/b.jpg', 'Red',          2400, 1);

-- o3 already has a suborder: 0012 must leave it completely alone.
INSERT INTO suborders (id, order_id, seller_id, status, subtotal, shipping_fee, commission_amount, tracking_number, courier_name)
VALUES ('sub_pre', 'o3', NULL, 'confirmed', 3500, 60, 0, 'TRK-999', 'Pathao');

INSERT INTO order_items (id, order_id, product_id, variant_id, seller_id, suborder_id, name, image, color, price, quantity)
VALUES ('i4', 'o3', 'p1', 'v1', 's1', 'sub_pre', 'Classic Watch', '/a.jpg', 'Black & Gold', 3500, 1);

-- o4 has no items at all.

INSERT INTO inventory_movements (id, variant_id, change_qty, reason, reference_type, reference_id)
VALUES ('m1', 'v1', -1, 'sale', 'order', 'o1');
