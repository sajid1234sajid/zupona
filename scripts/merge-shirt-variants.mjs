#!/usr/bin/env node
/**
 * Merges the three "Classic Full Sleeve Shirt" listings -- one per colour --
 * into one product with a Color option beside its Size option.
 *
 *   node scripts/merge-shirt-variants.mjs                 dry run, local database
 *   node scripts/merge-shirt-variants.mjs --remote        dry run, live database
 *   node scripts/merge-shirt-variants.mjs --remote --apply
 *
 * A dry run reads the database, prints what it would change and the redirect
 * map, and writes the SQL it would run to scripts/.merge-shirts.sql without
 * running it. --apply runs that SQL and then empties the catalog cache, so the
 * shop shows the merged product at once. `--persist-to <dir>` points a local
 * run at another local copy (e.g. one imported from a live export, to try the
 * merge first).
 *
 * What it does, all keyed by ids it reads first:
 *  - the first listing (Royal Blue) stays and gains a Color group with Royal
 *    Blue, Grey and Sky Blue, each with its listing's main photo;
 *  - the Grey and Sky Blue listings' variants, photos and videos move onto it,
 *    their sizes re-pointed at its M / L / XL; every variant gets a colour,
 *    the photo that colour switches to, and a fresh option signature;
 *  - orders, carts, wishlists, recently viewed, reviews, questions, flash sale
 *    entries and product coupons follow to the kept listing; sold counts add up;
 *  - the two old listings are archived (not deleted, so order history keeps
 *    its rows) and their addresses redirect to the kept one with ?color=.
 *
 * Idempotent: a listing already carrying a Color group is reported as merged
 * and nothing is written. Never edits stock: these products do not count it.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DB = "zupona-v3-db";
const KV_NAMESPACE = "d42d285e3d8a4f86a6bb8ea882fca621";

const TARGET = { slug: "classic-full-sleeve-shirt-2", color: "Royal Blue", hex: "#1f5fd6" };
const SOURCES = [
  { slug: "classic-full-sleeve-shirt-3", color: "Grey", hex: "#8a8f99" },
  { slug: "classic-full-sleeve-shirt-4", color: "Sky Blue", hex: "#5aa9e6" },
];

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const apply = args.includes("--apply");
const persistAt = args.indexOf("--persist-to");
const persistTo = persistAt >= 0 ? args[persistAt + 1] : null;
const where = remote ? ["--remote"] : ["--local", ...(persistTo ? ["--persist-to", persistTo] : [])];

function wrangler(extra) {
  return execFileSync("npx", ["wrangler", ...extra], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || "x" },
    maxBuffer: 64 * 1024 * 1024,
  });
}

function query(sql) {
  const out = wrangler(["d1", "execute", DB, ...where, "--json", "--command", sql]);
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}

const q = (value) => (value === null || value === undefined ? "NULL" : `'${String(value).replace(/'/g, "''")}'`);
const slugOf = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* ---------------------------------------------------------------- read --- */

const slugs = [TARGET.slug, ...SOURCES.map((source) => source.slug)];
const products = query(
  `SELECT id, slug, name, status, sold_count FROM products WHERE slug IN (${slugs.map(q).join(",")})`
);
const bySlug = new Map(products.map((row) => [row.slug, row]));
const target = bySlug.get(TARGET.slug);
if (!target) {
  console.error(`No product with slug ${TARGET.slug} in this database.`);
  process.exit(1);
}

const existingColor = query(
  `SELECT id FROM product_option_groups WHERE product_id = ${q(target.id)} AND key = 'color'`
);
if (existingColor.length > 0) {
  console.log(`Already merged: ${TARGET.slug} has a Color option. Nothing to do.`);
  process.exit(0);
}

const sources = SOURCES.map((source) => {
  const row = bySlug.get(source.slug);
  if (!row) {
    console.error(`No product with slug ${source.slug} in this database.`);
    process.exit(1);
  }
  if (row.status !== "active") {
    console.error(`${source.slug} is ${row.status}, not active. Stopping rather than guessing.`);
    process.exit(1);
  }
  return { ...source, ...row };
});

const ids = [target.id, ...sources.map((source) => source.id)];
const sizeGroups = query(
  `SELECT g.id, g.product_id FROM product_option_groups g
   WHERE g.key = 'size' AND g.product_id IN (${ids.map(q).join(",")})`
);
const sizeValues = query(
  `SELECT v.id, v.group_id, v.value FROM product_option_values v
   WHERE v.group_id IN (${sizeGroups.map((g) => q(g.id)).join(",")})`
);
const variants = query(
  `SELECT pv.id, pv.product_id, sv.value AS size
   FROM product_variants pv
   JOIN product_variant_options o ON o.variant_id = pv.id
   JOIN product_option_groups g ON g.id = o.group_id AND g.key = 'size'
   JOIN product_option_values sv ON sv.id = o.value_id
   WHERE pv.product_id IN (${ids.map(q).join(",")})`
);
const allVariants = query(
  `SELECT id, product_id FROM product_variants WHERE product_id IN (${ids.map(q).join(",")})`
);
const images = query(
  `SELECT id, product_id, url, sort_order, is_primary FROM product_images
   WHERE product_id IN (${ids.map(q).join(",")}) ORDER BY product_id, is_primary DESC, sort_order`
);
const counts = query(
  `SELECT 'order_items' AS t, product_id, COUNT(*) AS n FROM order_items WHERE product_id IN (${ids.map(q).join(",")}) GROUP BY product_id
   UNION ALL SELECT 'cart_items', product_id, COUNT(*) FROM cart_items WHERE product_id IN (${ids.map(q).join(",")}) GROUP BY product_id
   UNION ALL SELECT 'wishlist_items', product_id, COUNT(*) FROM wishlist_items WHERE product_id IN (${ids.map(q).join(",")}) GROUP BY product_id
   UNION ALL SELECT 'reviews', product_id, COUNT(*) FROM reviews WHERE product_id IN (${ids.map(q).join(",")}) GROUP BY product_id`
);

/* ------------------------------------------------------------ checks --- */

const targetSizeGroup = sizeGroups.find((group) => group.product_id === target.id);
if (!targetSizeGroup) {
  console.error(`${TARGET.slug} has no Size option to merge into.`);
  process.exit(1);
}
const targetSize = new Map(
  sizeValues.filter((value) => value.group_id === targetSizeGroup.id).map((value) => [value.value, value.id])
);
for (const variant of allVariants) {
  if (!variants.some((sized) => sized.id === variant.id)) {
    console.error(`Variant ${variant.id} has no size. Stopping rather than guessing.`);
    process.exit(1);
  }
}
for (const variant of variants) {
  if (!targetSize.has(variant.size)) {
    console.error(`Size "${variant.size}" of variant ${variant.id} is not offered on ${TARGET.slug}.`);
    process.exit(1);
  }
}
const primaryImage = (productId) => images.find((image) => image.product_id === productId) ?? null;

/* ------------------------------------------------------------- write --- */

const colorGroupId = `${target.id}-color`;
const colors = [{ ...TARGET, ...target }, ...sources].map((entry, index) => ({
  productId: entry.id,
  slug: entry.slug,
  label: entry.color,
  hex: entry.hex,
  valueId: `${target.id}-color-${slugOf(entry.color)}`,
  value: slugOf(entry.color),
  image: primaryImage(entry.id),
  sort: index,
}));
const colorOf = new Map(colors.map((color) => [color.productId, color]));

const sql = [];
sql.push(
  `INSERT OR IGNORE INTO product_option_groups (id, product_id, key, name, display, show_labels, sort_order, is_active)
   VALUES (${q(colorGroupId)}, ${q(target.id)}, 'color', 'Color', 'image', 1, 0, 1);`,
  `UPDATE product_option_groups SET sort_order = 1 WHERE id = ${q(targetSizeGroup.id)};`
);
for (const color of colors) {
  sql.push(
    `INSERT OR IGNORE INTO product_option_values (id, group_id, value, label, color_hex, image_url, sort_order, is_active)
     VALUES (${q(color.valueId)}, ${q(colorGroupId)}, ${q(color.value)}, ${q(color.label)}, ${q(color.hex)}, ${q(color.image?.url ?? null)}, ${color.sort}, 1);`
  );
}

// Photos: the kept listing's first, then each colour's, in colour order.
for (const [index, color] of colors.entries()) {
  if (color.productId === target.id) continue;
  sql.push(
    `UPDATE product_images SET product_id = ${q(target.id)}, is_primary = 0, sort_order = sort_order + ${index * 100},
            alt = COALESCE(alt, ${q(`${target.name} – ${color.label}`)})
     WHERE product_id = ${q(color.productId)};`,
    `UPDATE product_videos SET product_id = ${q(target.id)}, sort_order = sort_order + ${index * 100}
     WHERE product_id = ${q(color.productId)};`
  );
}

for (const variant of variants) {
  const color = colorOf.get(variant.product_id);
  const sizeId = targetSize.get(variant.size);
  const signature = `color=${color.valueId}|size=${sizeId}`;
  sql.push(
    `UPDATE product_variant_options SET group_id = ${q(targetSizeGroup.id)}, value_id = ${q(sizeId)}
     WHERE variant_id = ${q(variant.id)} AND group_id IN (SELECT id FROM product_option_groups WHERE key = 'size' AND product_id = ${q(variant.product_id)});`,
    `INSERT OR IGNORE INTO product_variant_options (variant_id, group_id, value_id)
     VALUES (${q(variant.id)}, ${q(colorGroupId)}, ${q(color.valueId)});`,
    `UPDATE product_variants SET product_id = ${q(target.id)}, option1_name = 'Color', option1_value = ${q(color.label)},
            option2_name = 'Size', image_id = ${q(color.image?.id ?? null)}, option_signature = ${q(signature)}
     WHERE id = ${q(variant.id)};`
  );
}

for (const source of sources) {
  const from = q(source.id);
  const to = q(target.id);
  sql.push(
    `UPDATE order_items SET product_id = ${to} WHERE product_id = ${from};`,
    // A cart line from before variants existed is unique by product and
    // colour; one that would collide stays where it is rather than be lost.
    `UPDATE OR IGNORE cart_items SET product_id = ${to} WHERE product_id = ${from};`,
    `UPDATE buy_now_sessions SET product_id = ${to} WHERE product_id = ${from};`,
    `UPDATE OR IGNORE wishlist_items SET product_id = ${to}, variant_id = NULL WHERE product_id = ${from};`,
    `DELETE FROM wishlist_items WHERE product_id = ${from};`,
    `UPDATE OR IGNORE recently_viewed SET product_id = ${to} WHERE product_id = ${from};`,
    `DELETE FROM recently_viewed WHERE product_id = ${from};`,
    `UPDATE reviews SET product_id = ${to} WHERE product_id = ${from};`,
    `UPDATE product_questions SET product_id = ${to} WHERE product_id = ${from};`,
    `UPDATE OR IGNORE flash_sale_items SET product_id = ${to} WHERE product_id = ${from};`,
    `UPDATE coupons SET scope_id = ${to} WHERE scope = 'product' AND scope_id = ${from};`,
    `UPDATE products SET sold_count = sold_count + ${Number(source.sold_count) || 0} WHERE id = ${to};`,
    `UPDATE products SET status = 'archived', updated_at = datetime('now') WHERE id = ${from};`,
    `INSERT OR REPLACE INTO product_redirects (from_slug, from_id, to_product_id, query)
     VALUES (${q(source.slug)}, ${from}, ${to}, ${q(`color=${slugOf(source.color)}`)});`
  );
}
// Ratings follow the reviews now on the kept listing.
sql.push(
  `UPDATE products SET
     rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = ${q(target.id)} AND is_approved = 1),
     rating_avg = COALESCE((SELECT ROUND(AVG(rating), 1) FROM reviews WHERE product_id = ${q(target.id)} AND is_approved = 1), 0),
     updated_at = datetime('now')
   WHERE id = ${q(target.id)};`
);

/* ------------------------------------------------------------ report --- */

const here = dirname(fileURLToPath(import.meta.url));
const sqlFile = join(here, ".merge-shirts.sql");
writeFileSync(sqlFile, sql.join("\n") + "\n");

const count = (table, productId) =>
  counts.find((row) => row.t === table && row.product_id === productId)?.n ?? 0;
console.log(`\n${apply ? "APPLYING" : "DRY RUN"} on the ${remote ? "LIVE" : "local"} database\n`);
console.log(`Keep:  ${target.slug}  (${target.name}) -> colours ${colors.map((c) => c.label).join(", ")}`);
for (const color of colors) {
  const own = variants.filter((variant) => variant.product_id === color.productId);
  console.log(
    `  ${color.label.padEnd(9)} from ${color.slug}: ${own.length} sizes (${own.map((v) => v.size.toUpperCase()).join("/")}), ` +
      `${images.filter((i) => i.product_id === color.productId).length} photos, sold ${bySlug.get(color.slug).sold_count}, ` +
      `order lines ${count("order_items", color.productId)}, carts ${count("cart_items", color.productId)}, ` +
      `wishlists ${count("wishlist_items", color.productId)}, reviews ${count("reviews", color.productId)}`
  );
}
console.log(`\nArchive: ${sources.map((source) => source.slug).join(", ")}`);
console.log("\nRedirect map (old address -> new address):");
for (const source of sources) {
  console.log(`  /products/${source.slug}  ->  /products/${target.slug}?color=${slugOf(source.color)}`);
}
console.log(`  /products/${target.slug}  stays (opens on the first colour in stock)`);
console.log(`\n${sql.length} SQL statements written to ${sqlFile}`);

if (!apply) {
  console.log("\nNothing was changed. Re-run with --apply to make these changes.");
  process.exit(0);
}

wrangler(["d1", "execute", DB, ...where, "--file", sqlFile]);
console.log("\nApplied.");

// The shop reads products through the KV catalog cache; empty it so the
// merged listing shows at once instead of when the entries expire.
try {
  const kvWhere = remote ? ["--remote"] : ["--local", ...(persistTo ? ["--persist-to", persistTo] : [])];
  const listed = wrangler(["kv", "key", "list", "--namespace-id", KV_NAMESPACE, "--prefix", "catalog:", ...kvWhere]);
  const keys = JSON.parse(listed.slice(listed.indexOf("["))).map((entry) => entry.name);
  if (keys.length > 0) {
    const keyFile = join(here, ".merge-shirts-keys.json");
    writeFileSync(keyFile, JSON.stringify(keys));
    wrangler(["kv", "bulk", "delete", keyFile, "--namespace-id", KV_NAMESPACE, "--force", ...kvWhere]);
  }
  console.log(`Catalog cache emptied (${keys.length} entries).`);
} catch (error) {
  console.warn("Could not empty the catalog cache; save any product in the admin panel to refresh it.", error.message);
}
