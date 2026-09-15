-- Groundwork for the admin Dynamic Option Builder.
--
-- 0009 gave the catalog N-number option groups and backfilled them from the
-- two fixed `option1_*` / `option2_*` slots. What it could not do is stop the
-- two representations drifting apart afterwards, because nothing writes both:
--
--   * `createProductAction` still writes only `option1_*` / `option2_*`, so a
--     product added through the admin panel reaches /products/<slug> with no
--     option selectors at all -- reproduced with the `qa-adminshape` fixture.
--   * The QA fixtures seeded straight into the canonical tables have the
--     opposite gap: no legacy columns, so /product/<id> shows nothing.
--
-- This migration does not fix the writers -- that is application code, and it
-- comes next. It prepares the schema those writers need and closes both gaps
-- in the data that exists today:
--
--   A  is_active on option groups and values
--   B  option_signature on variants
--   C  legacy -> canonical, for variants 0009 could not reach
--   D  canonical -> legacy, for variants that have no legacy option at all
--   E  compute every signature
--   F  prove no two active variants of one product share a combination
--   G  and only then make that a constraint
--
-- Nothing here drops a column, deletes a row, or rewrites a value that is
-- already set. Every UPDATE fills a NULL and every INSERT is OR IGNORE, so a
-- second run changes nothing. The ALTER TABLE statements are the usual
-- one-shot exception: SQLite rejects a duplicate column, and because D1
-- applies a --file atomically that failure rolls the whole file back.
--
-- A note on what these columns mean, because it is easy to get wrong:
-- deactivating an option value is a SELLABILITY change, not a stock movement.
-- Its variants become is_active = 0 and keep their stock_quantity,
-- reserved_quantity, SKU and price exactly as they are; no row is written to
-- inventory_movements. Re-activating the value brings the same variant back
-- with the same numbers. Stock only ever moves through src/lib/inventory.ts.

-- ---------------------------------------------------------------------------
-- A. A group or a value can be retired without being destroyed
-- ---------------------------------------------------------------------------
--
-- Deleting a value is not an option: product_variant_options cascades from it,
-- so a sold combination would lose the link that says what it was, the variant
-- would fall back to an empty signature, and two of them would then collide.
-- Retiring keeps the history and is what the storefront needs anyway -- a
-- colour that is gone for good should stop being offered, not stop existing.

ALTER TABLE product_option_groups ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE product_option_values ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- B. A variant's combination, as one comparable string
-- ---------------------------------------------------------------------------
--
-- `product_variant_options` has a primary key of (variant_id, group_id), which
-- stops one variant holding two values for the same group. It cannot stop two
-- variants holding the same set of values -- that is a property of a group of
-- rows, and no constraint can see it. Flattening the set onto the variant
-- makes it one column, which a unique index can see.
--
-- The format is `<group key>=<value id>` pairs, sorted by group key, joined
-- with `|`; an option-less variant gets the empty string. Value ids rather
-- than labels, so renaming "Black" to "Jet Black" does not silently mint a new
-- combination.

ALTER TABLE product_variants ADD COLUMN option_signature TEXT NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- C. Legacy -> canonical, for anything 0009 did not reach
-- ---------------------------------------------------------------------------
--
-- This is 0009 section 5 again, unchanged. It was written OR IGNORE and
-- grouped, so re-running it is a no-op for everything it already did and picks
-- up only variants created since -- which is exactly the set the admin panel
-- has been quietly producing.

-- C1. Groups from option1. Swatches when any variant in the group has a colour.
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
  -- ...unless the product already offers a group under this name. `key` is
  -- slugified from the name here, but a group created by the option builder
  -- keeps the key it was born with while its name is free to be renamed --
  -- "Color" to "Colour" -- so a name can belong to a group whose key no longer
  -- matches it. Without this guard UNIQUE (product_id, key) does not collide,
  -- a second group appears under the same name, the variant is linked to both,
  -- and its signature reads `color=..|colour=..`. Section D writes such a name
  -- into the legacy slot, so this is reachable on the very next run.
  AND NOT EXISTS (SELECT 1 FROM product_option_groups g
                   WHERE g.product_id = v.product_id AND g.name = v.option1_name)
GROUP BY v.product_id, v.option1_name;

-- C2. Groups from option2.
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
  AND NOT EXISTS (SELECT 1 FROM product_option_groups g
                   WHERE g.product_id = v.product_id AND g.name = v.option2_name)
GROUP BY v.product_id, v.option2_name;

-- C3. Values from option1.
--
-- 0009 wrote value and label alike, both the legacy display string. A value
-- created by the option builder will not: its `value` is a slug and its
-- `label` is what a shopper reads. The legacy slot holds the display string,
-- so `label` -- not `value` -- is what a legacy option matches on, here and in
-- C5. The NOT EXISTS stops a group that already offers "Black & Gold" as a
-- label from gaining a second row for the same colour under a different slug.
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
  AND NOT EXISTS (SELECT 1 FROM product_option_values ov
                   WHERE ov.group_id = g.id AND ov.label = v.option1_value)
GROUP BY g.id, v.option1_value;

-- C4. Values from option2.
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
  AND NOT EXISTS (SELECT 1 FROM product_option_values ov
                   WHERE ov.group_id = g.id AND ov.label = v.option2_value)
GROUP BY g.id, v.option2_value;

-- C5. Link each variant to the value it carries, for both slots.
INSERT OR IGNORE INTO product_variant_options (variant_id, group_id, value_id)
SELECT v.id, g.id, ov.id
FROM product_variants v
JOIN product_option_groups g
  ON g.product_id = v.product_id AND g.name = v.option1_name AND g.sort_order = 0
JOIN product_option_values ov
  ON ov.group_id = g.id AND ov.label = v.option1_value
WHERE v.option1_value IS NOT NULL;

INSERT OR IGNORE INTO product_variant_options (variant_id, group_id, value_id)
SELECT v.id, g.id, ov.id
FROM product_variants v
JOIN product_option_groups g
  ON g.product_id = v.product_id AND g.name = v.option2_name AND g.sort_order = 1
JOIN product_option_values ov
  ON ov.group_id = g.id AND ov.label = v.option2_value
WHERE v.option2_value IS NOT NULL;

-- ---------------------------------------------------------------------------
-- D. Canonical -> legacy, for variants with no legacy option at all
-- ---------------------------------------------------------------------------
--
-- /product/<id> reads `option1_value` as a colour and draws it as a swatch; it
-- has no way to render anything else. So the mirror is deliberately narrow:
-- only a `color` group reaches option1 and only a `size` group reaches
-- option2, and only where BOTH legacy slots are empty -- a variant that
-- already carries a size in option2 is left exactly as it is rather than
-- having a colour invented for it.
--
-- The label is what is written, not the value slug: the legacy slot is read
-- straight onto the page, and it is also what C5 matches on, so a mirror and a
-- backfill round-trip to the same row instead of minting a second one.
--
-- A Volume or Storage group is not mirrored. The legacy page cannot express it
-- and writing "30 ml" into the colour slot would draw it as a colour chip,
-- which is worse than the nothing it shows today. Such a product is readable
-- on /products/<slug>, which is the page that replaces it.

UPDATE product_variants
SET option1_name = (SELECT g.name
                      FROM product_variant_options o
                      JOIN product_option_groups g ON g.id = o.group_id
                     WHERE o.variant_id = product_variants.id AND g.key = 'color'),
    option1_value = (SELECT ov.label
                       FROM product_variant_options o
                       JOIN product_option_groups g ON g.id = o.group_id
                       JOIN product_option_values ov ON ov.id = o.value_id
                      WHERE o.variant_id = product_variants.id AND g.key = 'color'),
    swatch = COALESCE(swatch,
                      (SELECT ov.color_hex
                         FROM product_variant_options o
                         JOIN product_option_groups g ON g.id = o.group_id
                         JOIN product_option_values ov ON ov.id = o.value_id
                        WHERE o.variant_id = product_variants.id AND g.key = 'color'))
WHERE option1_value IS NULL
  AND option2_value IS NULL
  AND EXISTS (SELECT 1
                FROM product_variant_options o
                JOIN product_option_groups g ON g.id = o.group_id
               WHERE o.variant_id = product_variants.id AND g.key = 'color');

UPDATE product_variants
SET option2_name = (SELECT g.name
                      FROM product_variant_options o
                      JOIN product_option_groups g ON g.id = o.group_id
                     WHERE o.variant_id = product_variants.id AND g.key = 'size'),
    option2_value = (SELECT ov.label
                       FROM product_variant_options o
                       JOIN product_option_groups g ON g.id = o.group_id
                       JOIN product_option_values ov ON ov.id = o.value_id
                      WHERE o.variant_id = product_variants.id AND g.key = 'size')
WHERE option2_value IS NULL
  AND option1_value IS NULL
  AND EXISTS (SELECT 1
                FROM product_variant_options o
                JOIN product_option_groups g ON g.id = o.group_id
               WHERE o.variant_id = product_variants.id AND g.key = 'size');

-- ---------------------------------------------------------------------------
-- E. Compute every signature
-- ---------------------------------------------------------------------------
--
-- Inactive variants are included too. A retired combination has to keep its
-- signature so that re-activating it later lands on the same row instead of
-- creating a second one beside it.

UPDATE product_variants
SET option_signature = COALESCE(
      (SELECT group_concat(g.key || '=' || o.value_id, '|' ORDER BY g.key)
         FROM product_variant_options o
         JOIN product_option_groups g ON g.id = o.group_id
        WHERE o.variant_id = product_variants.id),
      '');

-- ---------------------------------------------------------------------------
-- F. Prove the constraint can hold before imposing it
-- ---------------------------------------------------------------------------
--
-- Reported rather than enforced: this SELECT must come back 0. If it does not,
-- G fails and D1 rolls the entire file back, so the check is belt and braces
-- -- but a number in the output is easier to read than a constraint error.

SELECT COUNT(*) AS duplicate_active_signatures
FROM (SELECT product_id
        FROM product_variants
       WHERE is_active = 1
       GROUP BY product_id, option_signature
      HAVING COUNT(*) > 1);

-- ---------------------------------------------------------------------------
-- G. One combination, one sellable variant
-- ---------------------------------------------------------------------------
--
-- Partial, on is_active = 1: a retired variant keeps its signature and must be
-- allowed to sit alongside the live one that replaced it.

CREATE UNIQUE INDEX IF NOT EXISTS idx_variant_combination
  ON product_variants (product_id, option_signature)
  WHERE is_active = 1;
