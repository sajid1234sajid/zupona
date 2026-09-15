-- Legacy data shaped like production before 0011: orders with no suborders,
-- variants in the old two-slot form, variants in the new canonical form, and a
-- variant with no options at all.

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

-- A. Legacy two-slot variants, no canonical rows at all (0013 section C).
INSERT INTO product_variants (id, product_id, sku, option1_name, option1_value, option2_name, option2_value, swatch, price, stock_quantity) VALUES
  ('v1', 'p1', 'CW-BG',  'Color', 'Black & Gold', NULL,   NULL, '#111111', NULL, 10),
  ('v2', 'p1', 'CW-SL',  'Color', 'Silver',       NULL,   NULL, '#cccccc', 3700,  4),
  ('v3', 'p2', 'RS-R42', 'Color', 'Red',          'Size', '42', '#dd2222', NULL,  6),
  ('v4', 'p2', 'RS-R43', 'Color', 'Red',          'Size', '43', '#dd2222', NULL,  3);

-- B. Canonical-only variants, no legacy columns.
INSERT INTO product_option_groups (id, product_id, key, name, display, show_labels, sort_order) VALUES
  ('g_vol', 'p3', 'volume', 'Volume', 'pill',   1, 0),
  ('g_col', 'p4', 'color',  'Colour', 'swatch', 1, 0);

INSERT INTO product_option_values (id, group_id, value, label, color_hex, sort_order) VALUES
  ('ov30',  'g_vol', '30ml',          '30 ml',         NULL,      0),
  ('ov50',  'g_vol', '50ml',          '50 ml',         NULL,      1),
  ('ovblu', 'g_col', 'midnight-blue', 'Midnight Blue', '#12325f', 0);

INSERT INTO product_variants (id, product_id, sku, stock_quantity) VALUES
  ('v5', 'p3', 'FS-30', 12),
  ('v6', 'p3', 'FS-50',  7),
  ('v7', 'p4', 'LW-MB',  5),
  ('v8', 'p5', 'CS-1',  40);   -- no options at all

INSERT INTO product_variant_options (variant_id, group_id, value_id) VALUES
  ('v5', 'g_vol', 'ov30'),
  ('v6', 'g_vol', 'ov50'),
  ('v7', 'g_col', 'ovblu');

-- C. Orders written before suborders existed.
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

-- A buy-now session, for the 0011 column.
INSERT INTO buy_now_sessions (id, user_id, product_id, variant_id, quantity, expires_at)
VALUES ('bn1', 'u1', 'p1', 'v1', 1, '2026-08-01 10:30:00');

-- A stock movement, so the 0011 partial unique index has something to see.
INSERT INTO inventory_movements (id, variant_id, change_qty, reason, reference_type, reference_id)
VALUES ('m1', 'v1', -1, 'sale', 'order', 'o1');
