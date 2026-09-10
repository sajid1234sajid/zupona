-- Dynamic, N-number product options.
--
-- Until now a variant could carry at most two options, and both were named in
-- code: `buildVariants()` always wrote option1_name = 'Color' and option2_name
-- = 'Size'. That is enough for a shirt and nothing else -- a phone needs
-- Storage + Colour, a serum needs Volume, a rug needs Material. This replaces
-- the two fixed slots with three tables that describe whatever options a
-- product actually has.
--
-- Nothing here removes or rewrites anything. `option1_*` and `option2_*` stay
-- exactly as they are and keep being written for one more release, so every
-- existing read path keeps working while the new one is proved out. The
-- backfill only ever inserts.
--
-- D1 applies a --file atomically, so a failure rolls the whole file back. The
-- ALTER TABLE statements are not re-runnable (SQLite rejects a duplicate
-- column), which is the normal one-shot migration contract: a second run fails
-- as a whole and changes nothing.

-- ---------------------------------------------------------------------------
-- 1. Option groups, their values, and which value each variant carries
-- ---------------------------------------------------------------------------

-- One row per option a product offers: "Color", "Size", "Storage", "Volume".
-- `display` is how the storefront draws it and `show_labels` whether the value
-- name is printed under a swatch -- the reference designs do both.
CREATE TABLE IF NOT EXISTS product_option_groups (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  key TEXT NOT NULL,                          -- color | size | storage | volume | material
  name TEXT NOT NULL,                         -- "Color", "Storage"
  display TEXT NOT NULL DEFAULT 'pill',       -- swatch | image | pill | dropdown
  show_labels INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, key)
);

CREATE INDEX IF NOT EXISTS idx_option_groups_product
  ON product_option_groups (product_id, sort_order);

-- The choices inside a group. `color_hex` and `image_url` are what a swatch
-- draws; a pill needs neither.
CREATE TABLE IF NOT EXISTS product_option_values (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
  value TEXT NOT NULL,                        -- "black-gold", "XL", "128gb"
  label TEXT NOT NULL,                        -- "Black & Gold", "XL", "128 GB"
  color_hex TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (group_id, value)
);

CREATE INDEX IF NOT EXISTS idx_option_values_group
  ON product_option_values (group_id, sort_order);

-- Which value a variant carries in each group. `value_id` is a real reference
-- rather than repeated text, so renaming a value cannot leave variants
-- pointing at a string that no longer exists. The primary key is what stops a
-- variant holding two values for the same group.
CREATE TABLE IF NOT EXISTS product_variant_options (
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  group_id   TEXT NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
  value_id   TEXT NOT NULL REFERENCES product_option_values(id) ON DELETE CASCADE,
  PRIMARY KEY (variant_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_variant_options_value
  ON product_variant_options (value_id);

-- ---------------------------------------------------------------------------
-- 2. A variant can point at one of the product's images
-- ---------------------------------------------------------------------------

-- Picking a colour swaps the main image. This references product_images rather
-- than being a free-form "media id" because a variant should only ever select
-- a still: nobody expects the gallery to jump to a video when they choose a
-- colour, and a single foreign key cannot span two tables. `image_url` on this
-- table is left alone; it has never been read or written.
ALTER TABLE product_variants ADD COLUMN image_id TEXT REFERENCES product_images(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Fields the product page shows but the schema had nowhere to keep
-- ---------------------------------------------------------------------------

ALTER TABLE products ADD COLUMN short_description TEXT;  -- "Premium Cotton | Regular Fit"
ALTER TABLE products ADD COLUMN badge_label TEXT;        -- "Best Seller" | "Popular" | "New Arrival"
ALTER TABLE products ADD COLUMN return_policy TEXT;      -- "7 Days Return"
ALTER TABLE products ADD COLUMN warranty TEXT;           -- "1 Year Warranty"
ALTER TABLE product_features ADD COLUMN value TEXT;      -- optional second line under a feature
ALTER TABLE product_images ADD COLUMN alt TEXT;
ALTER TABLE product_videos ADD COLUMN alt TEXT;

-- ---------------------------------------------------------------------------
-- 4. Buy Now, as its own thing rather than a detour through the cart
-- ---------------------------------------------------------------------------

-- Buy Now used to add the item to the cart and send the shopper to checkout,
-- which quietly bought whatever else was already in there. A session holds the
-- one line being bought and leaves the cart untouched.
CREATE TABLE IF NOT EXISTS buy_now_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_buy_now_user ON buy_now_sessions (user_id);

-- ---------------------------------------------------------------------------
-- 5. Backfill: the two fixed slots become groups, values and links
-- ---------------------------------------------------------------------------
--
-- Four shapes exist in the data and all four are handled:
--   option1 only            -- a colour, the common case
--   option1 + option2       -- colour and size
--   option2 only            -- size with no colour, which is what buildVariants
--                              writes for a shoe (option1 left NULL)
--   neither                 -- a single variant with no options at all, which
--                              produces no groups, which is correct
--
-- `sort_order` on a value is the variant's rowid, which is the order the
-- storefront already shows colours in, so nothing reorders.

-- 5a. Groups from option1. A group is drawn as swatches when any variant in it
--     has a swatch colour, and as pills otherwise.
INSERT OR IGNORE INTO product_option_groups (id, product_id, key, name, display, show_labels, sort_order)
SELECT lower(hex(randomblob(16))),
       v.product_id,
       replace(lower(v.option1_name), ' ', '-'),
       v.option1_name,
       CASE WHEN MAX(CASE WHEN v.swatch IS NOT NULL AND v.swatch <> '' THEN 1 ELSE 0 END) = 1
            THEN 'swatch' ELSE 'pill' END,
       1,
       0
FROM product_variants v
WHERE v.option1_value IS NOT NULL AND v.option1_name IS NOT NULL
GROUP BY v.product_id, v.option1_name;

-- 5b. Groups from option2.
INSERT OR IGNORE INTO product_option_groups (id, product_id, key, name, display, show_labels, sort_order)
SELECT lower(hex(randomblob(16))),
       v.product_id,
       replace(lower(v.option2_name), ' ', '-'),
       v.option2_name,
       'pill',
       1,
       1
FROM product_variants v
WHERE v.option2_value IS NOT NULL AND v.option2_name IS NOT NULL
GROUP BY v.product_id, v.option2_name;

-- 5c. Values from option1, de-duplicated across the variants that share them.
INSERT OR IGNORE INTO product_option_values (id, group_id, value, label, color_hex, sort_order)
SELECT lower(hex(randomblob(16))),
       g.id,
       v.option1_value,
       v.option1_value,
       MIN(NULLIF(v.swatch, '')),
       MIN(v.rowid)
FROM product_variants v
JOIN product_option_groups g
  ON g.product_id = v.product_id
 AND g.name = v.option1_name
 AND g.sort_order = 0
WHERE v.option1_value IS NOT NULL
GROUP BY g.id, v.option1_value;

-- 5d. Values from option2.
INSERT OR IGNORE INTO product_option_values (id, group_id, value, label, color_hex, sort_order)
SELECT lower(hex(randomblob(16))),
       g.id,
       v.option2_value,
       v.option2_value,
       NULL,
       MIN(v.rowid)
FROM product_variants v
JOIN product_option_groups g
  ON g.product_id = v.product_id
 AND g.name = v.option2_name
 AND g.sort_order = 1
WHERE v.option2_value IS NOT NULL
GROUP BY g.id, v.option2_value;

-- 5e. Link each variant to the value it carries, for both slots.
INSERT OR IGNORE INTO product_variant_options (variant_id, group_id, value_id)
SELECT v.id, g.id, ov.id
FROM product_variants v
JOIN product_option_groups g
  ON g.product_id = v.product_id AND g.name = v.option1_name AND g.sort_order = 0
JOIN product_option_values ov
  ON ov.group_id = g.id AND ov.value = v.option1_value
WHERE v.option1_value IS NOT NULL;

INSERT OR IGNORE INTO product_variant_options (variant_id, group_id, value_id)
SELECT v.id, g.id, ov.id
FROM product_variants v
JOIN product_option_groups g
  ON g.product_id = v.product_id AND g.name = v.option2_name AND g.sort_order = 1
JOIN product_option_values ov
  ON ov.group_id = g.id AND ov.value = v.option2_value
WHERE v.option2_value IS NOT NULL;
