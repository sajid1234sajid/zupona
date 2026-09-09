-- Zupona marketplace platform migration.
-- Upgrades an existing database (created from an older db/schema.sql) to the
-- full multi-vendor marketplace schema: real product catalog, sellers,
-- inventory, coupons/flash sales, reviews, multi-seller order fulfillment,
-- payments/payouts, support tickets and admin audit logging.
--
-- Run once per existing database:
--   npx wrangler d1 execute zupona-db --local  --file=./db/migrations/0003_marketplace_platform.sql
--   npx wrangler d1 execute zupona-db --remote --file=./db/migrations/0003_marketplace_platform.sql
-- New installs don't need this -- db/schema.sql already includes it all.

-- ============================================================================
-- 1. IDENTITY & ACCESS -- extend users, add OAuth/security/audit tables
-- ============================================================================

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'; -- customer|seller|admin|support
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'; -- active|suspended|banned
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN referral_code TEXT;
ALTER TABLE users ADD COLUMN referred_by TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;
-- SQLite cannot ADD COLUMN with a non-constant default, so updated_at is added
-- nullable here and backfilled. (Fresh installs from db/schema.sql get
-- NOT NULL DEFAULT (datetime('now')) -- the only intentional drift between
-- a migrated and a freshly-created database.)
ALTER TABLE users ADD COLUMN updated_at TEXT;
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users (referral_code) WHERE referral_code IS NOT NULL;

-- Generalized OAuth identities (Google today; Facebook/Apple/etc. later)
-- without disturbing the existing users.google_id fast-path column.
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- google|facebook|apple
  provider_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts (user_id);

-- Sessions gain device metadata for the account "active sessions" / security page.
ALTER TABLE sessions ADD COLUMN ip_address TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;

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

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  subtitle TEXT,
  image_url TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories (parent_id);

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

CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images (product_id);

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
-- 4. CUSTOMER-FACING TABLES -- extend cart/wishlist to reference real products
-- ============================================================================

ALTER TABLE cart_items ADD COLUMN variant_id TEXT;
ALTER TABLE cart_items ADD COLUMN seller_id TEXT;
ALTER TABLE wishlist_items ADD COLUMN variant_id TEXT;

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
  is_approved INTEGER NOT NULL DEFAULT 1,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews (user_id);

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
-- 7. ORDERS -- extend for multi-seller fulfillment, payments, returns
-- ============================================================================

ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'; -- pending|paid|failed|refunded|partially_refunded
ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN discount_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'BDT';
ALTER TABLE orders ADD COLUMN updated_at TEXT; -- nullable: see users.updated_at note above
UPDATE orders SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE order_items ADD COLUMN variant_id TEXT;
ALTER TABLE order_items ADD COLUMN seller_id TEXT;
ALTER TABLE order_items ADD COLUMN suborder_id TEXT;
ALTER TABLE order_items ADD COLUMN cost_price INTEGER NOT NULL DEFAULT 0; -- snapshot, for margin reporting

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
-- 9. SUPPORT
-- ============================================================================

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
