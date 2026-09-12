-- Category system: bilingual copy, merchandising flags, SEO fields and the
-- many-to-many product link.
--
-- Everything here is additive. The existing `categories` table keeps every
-- column it had and `products.category_id` keeps its meaning, so nothing that
-- reads the catalog today has to change to keep working.
--
-- Two naming notes, because the column list looks redundant at first glance:
--
--  * `name` stays the canonical display name -- roughly fifteen queries across
--    the storefront, the admin panel and the order history select it, and
--    renaming it would have touched all of them for no gain. `name_en` is
--    added beside it and kept equal to it by the category service; `name_bn`
--    is the Bangla name and is genuinely new.
--  * `icon` is a lucide icon *name* ("Shirt"); `icon_url` is an uploaded image.
--    They are different things, so the new column sits alongside rather than
--    replacing it.
--
-- `subtitle` remains the one-line tagline printed under a category tile.
-- `description_en` / `description_bn` are the longer copy the category landing
-- page prints under its heading, which is why neither is backfilled from it.

-- 1. Bilingual copy ----------------------------------------------------------
ALTER TABLE categories ADD COLUMN name_en TEXT;
ALTER TABLE categories ADD COLUMN name_bn TEXT;
ALTER TABLE categories ADD COLUMN description_en TEXT;
ALTER TABLE categories ADD COLUMN description_bn TEXT;

-- 2. Artwork -----------------------------------------------------------------
ALTER TABLE categories ADD COLUMN icon_url TEXT;

-- 3. Merchandising placement -------------------------------------------------
-- Defaults keep today's behaviour exactly: every existing category still shows
-- everywhere it shows now, and only `is_featured` starts off narrowed.
ALTER TABLE categories ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN show_on_homepage INTEGER NOT NULL DEFAULT 1;
ALTER TABLE categories ADD COLUMN show_in_navigation INTEGER NOT NULL DEFAULT 1;

-- 4. SEO ---------------------------------------------------------------------
ALTER TABLE categories ADD COLUMN seo_title TEXT;
ALTER TABLE categories ADD COLUMN seo_description TEXT;

-- 5. Audit -------------------------------------------------------------------
-- Nullable and backfilled: SQLite rejects ALTER TABLE ... ADD COLUMN with a
-- non-constant default, so a migrated database has a nullable `updated_at`
-- where a fresh one has NOT NULL DEFAULT (datetime('now')). That is the same
-- intended drift the 0003 migration documents.
ALTER TABLE categories ADD COLUMN updated_at TEXT;

-- 6. Backfill ----------------------------------------------------------------
UPDATE categories
   SET name_en    = COALESCE(name_en, name),
       updated_at = COALESCE(updated_at, created_at);

-- Departments lead the homepage's featured rail out of the box; anything the
-- admin ticks afterwards joins them.
UPDATE categories SET is_featured = 1 WHERE parent_id IS NULL;

-- 7. Indexes -----------------------------------------------------------------
-- The tree is read on nearly every page, always filtered by the placement
-- flags and ordered by sort_order. `slug` already has the unique index SQLite
-- creates for the UNIQUE constraint, so it is not repeated here.
CREATE INDEX IF NOT EXISTS idx_categories_navigation
  ON categories (is_active, show_in_navigation, sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_homepage
  ON categories (is_active, show_on_homepage, sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_featured
  ON categories (is_active, is_featured, sort_order);

-- 8. Product <-> category ----------------------------------------------------
-- A product has one *primary* category -- which stays `products.category_id`,
-- because that column is what the catalog, the admin product form and every
-- order report already read -- and may additionally be filed under others.
--
-- ON DELETE CASCADE here removes the *link*, never the product: deleting a
-- category a product is cross-listed in simply un-files it from that category.
-- Deleting a category that is some product's primary one is refused in
-- src/lib/categoryService.ts before it ever reaches SQL.
CREATE TABLE IF NOT EXISTS product_categories (
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_category
  ON product_categories (category_id);

-- One primary per product, enforced by the database rather than by whoever
-- happens to be writing the row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_primary
  ON product_categories (product_id) WHERE is_primary = 1;

-- Every product that already has a category gets its primary link.
INSERT OR IGNORE INTO product_categories (product_id, category_id, is_primary)
SELECT id, category_id, 1 FROM products WHERE category_id IS NOT NULL;
