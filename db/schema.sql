-- Zupona schema (Cloudflare D1 / SQLite) -- full marketplace platform.
-- NOTE: this file is safe to re-run against a fresh database (everything is
-- CREATE ... IF NOT EXISTS). Against an existing database it will NOT add
-- new columns to already-existing tables (SQLite has no "ADD COLUMN IF NOT
-- EXISTS") -- for that, apply the numbered file(s) in db/migrations/ once,
-- in order. New installs only need this file.

-- ============================================================================
-- 1. IDENTITY & ACCESS
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  avatar_url TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'customer', -- customer|seller|admin|support
  status TEXT NOT NULL DEFAULT 'active', -- active|suspended|banned
  email_verified INTEGER NOT NULL DEFAULT 0,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT,
  referred_by TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users (referral_code) WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);

-- Generalized OAuth identities (Google today; Facebook/Apple/etc. later)
-- without disturbing the fast-path users.google_id column.
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- google|facebook|apple
  provider_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts (user_id);

-- Every login attempt (success or failure), for lockout logic and the
-- account security page's "recent activity" list.
CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL, -- email or phone attempted
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  success INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts (identifier, created_at);

-- Saved delivery addresses
CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line1 TEXT NOT NULL,
  area TEXT,
  city TEXT NOT NULL,
  postal_code TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses (user_id);

-- Saved payment methods. Only masked/last-4 details are ever stored - full
-- card numbers and CVVs are never persisted.
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'card' | 'bkash' | 'nagad' | 'cod'
  label TEXT NOT NULL,
  detail TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods (user_id);

-- ============================================================================
-- 2. SELLERS / VENDORS (multi-vendor marketplace, Daraz/Alibaba style)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sellers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  banner_url TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|suspended|rejected
  commission_rate REAL NOT NULL DEFAULT 10.0, -- percent, platform take rate
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  total_sales INTEGER NOT NULL DEFAULT 0, -- lifetime revenue, whole Taka
  payout_method TEXT, -- bank|bkash|nagad
  payout_details TEXT, -- JSON: account number/name, never card/CVV data
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON sellers (user_id);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers (status);

-- KYC / business verification documents, stored in R2 (this row holds the
-- object key/URL and review state, never the raw file).
CREATE TABLE IF NOT EXISTS seller_documents (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL, -- national_id|trade_license|tin|bank_statement
  file_key TEXT NOT NULL, -- R2 object key
  status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_seller_documents_seller_id ON seller_documents (seller_id);

-- ============================================================================
-- 3. CATALOG -- categories, brands, products, variants, images, attributes
-- ============================================================================

-- Three levels at most (department -> section -> type); the depth guard lives
-- in src/lib/categoryService.ts, which is also what refuses a parent that
-- would make the tree circular.
--
-- `name` is the canonical display name and `name_en` is kept equal to it;
-- `name_bn` carries the Bangla name. `subtitle` is the one-line tagline under
-- a tile, `description_*` the longer copy on the category landing page.
-- `icon` is a lucide icon name, `icon_url` an uploaded image.
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_en TEXT,
  name_bn TEXT,
  slug TEXT NOT NULL UNIQUE,
  subtitle TEXT,
  description_en TEXT,
  description_bn TEXT,
  image_url TEXT,
  icon TEXT,
  icon_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_featured INTEGER NOT NULL DEFAULT 0,
  show_on_homepage INTEGER NOT NULL DEFAULT 1,
  show_in_navigation INTEGER NOT NULL DEFAULT 1,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_navigation
  ON categories (is_active, show_in_navigation, sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_homepage
  ON categories (is_active, show_on_homepage, sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_featured
  ON categories (is_active, is_featured, sort_order);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  seller_id TEXT REFERENCES sellers(id) ON DELETE SET NULL, -- NULL = platform-owned (1P) product
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sku TEXT UNIQUE,
  description TEXT,
  hero_headline TEXT,
  hero_subtitle TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- draft|pending_review|active|rejected|archived
  price INTEGER NOT NULL DEFAULT 0, -- whole Taka, matching formatPrice() in src/lib/format.ts
  old_price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_best_seller INTEGER NOT NULL DEFAULT 0,
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  sold_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  weight_grams INTEGER,
  dimensions_json TEXT, -- {"l":0,"w":0,"h":0}
  meta_title TEXT,
  meta_description TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products (seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products (brand_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products (is_featured);

-- Cross-listing. A product's *primary* category stays products.category_id --
-- that column is what the catalog, the admin product form and every order
-- report read -- and this table lets the same product also appear under other
-- categories. The partial unique index keeps exactly one primary link.
--
-- ON DELETE CASCADE removes the link, never the product: deleting a category a
-- product is cross-listed in un-files it from that category and nothing more.
CREATE TABLE IF NOT EXISTS product_categories (
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_category
  ON product_categories (category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_primary
  ON product_categories (product_id) WHERE is_primary = 1;

CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images (product_id);

-- Product video clips. Kept apart from product_images because every catalog
-- query pulls a thumbnail URL out of that table and renders it as an image;
-- a video row in there would show up as a broken listing card. The bytes live
-- in the same R2 bucket under a videos/ prefix.
CREATE TABLE IF NOT EXISTS product_videos (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  poster_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_videos_product_id ON product_videos (product_id);

-- Sellable variants (color/size combinations). Every product has at least
-- one variant row, even simple products with a single implicit variant --
-- this is what stock, price overrides and cart/order line items key off.
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT UNIQUE,
  option1_name TEXT, -- e.g. "Color"
  option1_value TEXT, -- e.g. "Black & Gold"
  option2_name TEXT, -- e.g. "Size"
  option2_value TEXT, -- e.g. "XL"
  swatch TEXT, -- hex or CSS gradient for color chips
  price INTEGER, -- NULL = inherit products.price
  old_price INTEGER,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0, -- held by open carts/pending orders
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  image_url TEXT,
  barcode TEXT,
  weight_grams INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants (product_id);

-- Free-form spec sheet (e.g. "Battery Life" -> "18 hours").
CREATE TABLE IF NOT EXISTS product_attributes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attr_name TEXT NOT NULL,
  attr_value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_attributes_product_id ON product_attributes (product_id);

-- Highlight badges shown on product cards (icon name matches a lucide-react
-- icon key resolved client-side, e.g. "Droplets" -> "Water Resistant").
CREATE TABLE IF NOT EXISTS product_features (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  icon TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_features_product_id ON product_features (product_id);

-- Append-only stock ledger. product_variants.stock_quantity is the fast
-- current-value cache; this table is the audit trail behind it.
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  change_qty INTEGER NOT NULL, -- positive = restock/return, negative = sale/adjustment
  reason TEXT NOT NULL, -- restock|sale|return|adjustment|damaged
  reference_type TEXT, -- order|return|manual
  reference_id TEXT,
  note TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant_id ON inventory_movements (variant_id);

-- Price change audit trail (analytics + "price history" chart on PDP).
CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  old_price INTEGER NOT NULL DEFAULT 0,
  changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history (product_id);

-- ============================================================================
-- 4. CUSTOMER-FACING: wishlist, cart, browsing history, search
-- ============================================================================

CREATE TABLE IF NOT EXISTS wishlist_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  -- Price when the item was saved, written once and never updated. The
  -- wishlist shows a price-drop badge by comparing it to today price.
  -- NULL for rows saved before migration 0004, which show no badge.
  saved_price INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist_items (user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_created ON wishlist_items (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  seller_id TEXT,
  color TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, product_id, color)
);

CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart_items (user_id);

CREATE TABLE IF NOT EXISTS recently_viewed (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_id ON recently_viewed (user_id, viewed_at);

CREATE TABLE IF NOT EXISTS search_queries (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_search_queries_query ON search_queries (query);

-- ============================================================================
-- 5. MERCHANDISING -- coupons, flash sales
-- ============================================================================

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL, -- percent|fixed|free_shipping
  discount_value INTEGER NOT NULL DEFAULT 0, -- percent (0-100), or whole Taka for 'fixed'
  min_order_amount INTEGER NOT NULL DEFAULT 0,
  max_discount_amount INTEGER, -- caps percent-based discounts
  usage_limit INTEGER, -- NULL = unlimited
  usage_count INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  scope TEXT NOT NULL DEFAULT 'all', -- all|category|product|seller
  scope_id TEXT,
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons (code);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_id ON coupon_redemptions (coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user_id ON coupon_redemptions (user_id);

CREATE TABLE IF NOT EXISTS flash_sales (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS flash_sale_items (
  id TEXT PRIMARY KEY,
  flash_sale_id TEXT NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
  sale_price INTEGER NOT NULL,
  stock_limit INTEGER,
  sold_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_flash_sale_items_sale_id ON flash_sale_items (flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_flash_sale_items_product_id ON flash_sale_items (product_id);

-- Homepage merchandising slots, editable from the admin marketing page so a
-- campaign can be run without a deploy.
CREATE TABLE IF NOT EXISTS banners (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  placement TEXT NOT NULL DEFAULT 'hero', -- hero|promo|discover
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_banners_placement ON banners (placement, sort_order);

-- ============================================================================
-- 6. REVIEWS & Q&A
-- ============================================================================

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_item_id TEXT REFERENCES order_items(id) ON DELETE SET NULL, -- present = verified purchase
  rating INTEGER NOT NULL, -- 1-5
  title TEXT,
  body TEXT,
  seller_reply TEXT,
  seller_replied_at TEXT,
  is_approved INTEGER NOT NULL DEFAULT 1, -- what storefront queries filter on
  status TEXT NOT NULL DEFAULT 'approved', -- approved|pending|rejected|spam (moderation queue)
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews (status);

CREATE TABLE IF NOT EXISTS review_images (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  url TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_images_review_id ON review_images (review_id);

CREATE TABLE IF NOT EXISTS product_questions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_questions_product_id ON product_questions (product_id);

CREATE TABLE IF NOT EXISTS product_answers (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES product_questions(id) ON DELETE CASCADE,
  responder_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_answers_question_id ON product_answers (question_id);

-- ============================================================================
-- 7. ORDERS & FULFILLMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'placed', -- placed|confirmed|shipped|out_for_delivery|delivered|cancelled
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending|paid|failed|refunded|partially_refunded
  subtotal INTEGER NOT NULL,
  shipping_fee INTEGER NOT NULL DEFAULT 0,
  discount_total INTEGER NOT NULL DEFAULT 0,
  coupon_code TEXT,
  total INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  points_earned INTEGER NOT NULL DEFAULT 0,
  address_label TEXT NOT NULL,
  address_full_name TEXT NOT NULL,
  address_phone TEXT NOT NULL,
  address_line TEXT NOT NULL,
  address_area TEXT,
  address_city TEXT NOT NULL DEFAULT '',
  payment_label TEXT NOT NULL,
  delivery_method TEXT NOT NULL DEFAULT 'standard', -- standard|express
  placed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  seller_id TEXT,
  suborder_id TEXT,
  name TEXT NOT NULL,
  image TEXT NOT NULL,
  color TEXT,
  price INTEGER NOT NULL,
  old_price INTEGER NOT NULL DEFAULT 0,
  cost_price INTEGER NOT NULL DEFAULT 0, -- snapshot, for margin reporting
  quantity INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

-- A single checkout order splits into one suborder per seller, mirroring
-- how Daraz/Amazon fulfillment and per-seller shipment tracking works.
CREATE TABLE IF NOT EXISTS suborders (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id TEXT REFERENCES sellers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'placed', -- placed|confirmed|shipped|out_for_delivery|delivered|cancelled|returned
  subtotal INTEGER NOT NULL DEFAULT 0,
  shipping_fee INTEGER NOT NULL DEFAULT 0,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  tracking_number TEXT,
  courier_name TEXT,
  shipped_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_suborders_order_id ON suborders (order_id);
CREATE INDEX IF NOT EXISTS idx_suborders_seller_id ON suborders (seller_id);

CREATE TABLE IF NOT EXISTS order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  suborder_id TEXT REFERENCES suborders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history (order_id);

CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  suborder_id TEXT NOT NULL REFERENCES suborders(id) ON DELETE CASCADE,
  courier_name TEXT,
  tracking_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|in_transit|delivered|failed
  shipped_at TEXT,
  delivered_at TEXT,
  estimated_delivery_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shipments_suborder_id ON shipments (suborder_id);

CREATE TABLE IF NOT EXISTS returns_refunds (
  id TEXT PRIMARY KEY,
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'requested', -- requested|approved|rejected|refunded|completed
  refund_amount INTEGER NOT NULL DEFAULT 0,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_returns_refunds_order_item_id ON returns_refunds (order_item_id);
CREATE INDEX IF NOT EXISTS idx_returns_refunds_user_id ON returns_refunds (user_id);

-- Phone codes for the checkout verification step. The row id is the only thing
-- that ever reaches the browser (in an httpOnly cookie), so a visitor cannot
-- forge a "verified" state by editing their own cookie.
CREATE TABLE IF NOT EXISTS phone_verifications (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications (phone);

-- ============================================================================
-- 8. PAYMENTS & SELLER PAYOUTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- cod|bkash|nagad|card|stripe
  provider_ref TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'pending', -- pending|success|failed|refunded
  raw_response TEXT, -- JSON, gateway payload for reconciliation
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions (order_id);

CREATE TABLE IF NOT EXISTS seller_payouts (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  gross_sales INTEGER NOT NULL DEFAULT 0,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  net_payout INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|processing|paid|failed
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_seller_payouts_seller_id ON seller_payouts (seller_id);

CREATE TABLE IF NOT EXISTS payout_line_items (
  id TEXT PRIMARY KEY,
  payout_id TEXT NOT NULL REFERENCES seller_payouts(id) ON DELETE CASCADE,
  suborder_id TEXT NOT NULL REFERENCES suborders(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payout_line_items_payout_id ON payout_line_items (payout_id);

-- ============================================================================
-- 9. NOTIFICATIONS & SUPPORT
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system', -- order|promo|system
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open|pending|resolved|closed
  priority TEXT NOT NULL DEFAULT 'normal', -- low|normal|high|urgent
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (status);

CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL, -- customer|support|admin
  body TEXT NOT NULL,
  attachment_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages (ticket_id);

-- ============================================================================
-- 10. ADMIN & PLATFORM CONFIG
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- e.g. product.approve, seller.suspend, coupon.create
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON admin_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON admin_audit_log (admin_user_id);

-- Simple key/value store for global site config (homepage banners, default
-- commission, feature flags) editable from an admin panel without a deploy.
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
