// Generates db/seed.sql from the static catalog in src/data/*.ts.
//
//   node db/generate-seed.mjs
//   npx wrangler d1 execute zupona-v3-db --local  --file=./db/seed.sql
//   npx wrangler d1 execute zupona-v3-db --remote --file=./db/seed.sql
//
// The static files stay the source of truth for the *initial* catalog; once
// products are edited through the admin/seller tooling the database is
// authoritative and this script should not be re-run over live data. Every
// statement is INSERT OR IGNORE, so re-running never overwrites edited rows.
//
// Product ids are carried over verbatim from src/data/products.ts so existing
// cart_items / wishlist_items / order_items rows keep pointing at real rows.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Pulls `export const <name> ... = [ ... ];` out of a .ts file and evaluates
 * it as a plain JS literal. Lucide icon identifiers (`icon: Droplets`) are
 * rewritten to strings first -- the database stores the icon *name*, which the
 * UI maps back to a component. */
function readArray(relPath, exportName) {
  const source = fs.readFileSync(path.join(root, relPath), "utf8");
  const startMarker = new RegExp(`export const ${exportName}[^=]*=\\s*\\[`);
  const match = startMarker.exec(source);
  if (!match) throw new Error(`Could not find export ${exportName} in ${relPath}`);

  const open = match.index + match[0].length - 1;
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "[") depth++;
    else if (source[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) throw new Error(`Unbalanced array literal for ${exportName}`);

  const literal = source
    .slice(open, end)
    .replace(/icon:\s*([A-Za-z_$][\w$]*)/g, 'icon: "$1"');

  return new Function(`return ${literal};`)();
}

const categories = readArray("src/data/categories.ts", "categories");
const products = readArray("src/data/products.ts", "products");

const DEFAULT_STOCK = 50;

function q(value) {
  if (value === undefined || value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const lines = [];
lines.push("-- GENERATED FILE -- do not edit by hand.");
lines.push("-- Regenerate with: node db/generate-seed.mjs");
lines.push("-- Seeds the initial Zupona catalog (categories, brands, products,");
lines.push("-- images, variants, feature badges) plus baseline platform settings.");
lines.push("-- Every statement is INSERT OR IGNORE: safe to re-run, never clobbers");
lines.push("-- rows that have since been edited through the admin tooling.");
lines.push("");

/* -- Categories ------------------------------------------------------------ */
// Two levels: top-level departments (parent_id NULL) and their subcategories
// (parent_id = the department's id). Products point at the subcategory when
// they have one, so a category page can filter by either level.
lines.push("-- Categories: top-level departments plus their subcategories");
categories.forEach((category, index) => {
  lines.push(
    "INSERT OR IGNORE INTO categories (id, parent_id, name, slug, subtitle, image_url, sort_order, is_active) VALUES " +
      `(${q(category.id)}, NULL, ${q(category.name)}, ${q(category.id)}, ${q(category.subtitle ?? null)}, ${q(category.image)}, ${index}, 1);`
  );

  (category.subcategories ?? []).forEach((sub, subIndex) => {
    lines.push(
      "INSERT OR IGNORE INTO categories (id, parent_id, name, slug, subtitle, image_url, sort_order, is_active) VALUES " +
        `(${q(sub.id)}, ${q(category.id)}, ${q(sub.name)}, ${q(sub.id)}, NULL, ${q(sub.image)}, ${subIndex}, 1);`
    );
  });
});
lines.push("");

/* -- Brands --------------------------------------------------------------- */
const brandNames = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort();
const brandIdByName = new Map(brandNames.map((name) => [name, `brand-${slugify(name)}`]));
lines.push("-- Brands, derived from the distinct brand names in the static catalog");
for (const name of brandNames) {
  lines.push(
    "INSERT OR IGNORE INTO brands (id, name, slug) VALUES " +
      `(${q(brandIdByName.get(name))}, ${q(name)}, ${q(slugify(name))});`
  );
}
lines.push("");

/* -- Products ------------------------------------------------------------- */
lines.push("-- Products. seller_id stays NULL: these are platform-owned (first-party)");
lines.push("-- listings. Marketplace sellers set seller_id on their own products.");
for (const product of products) {
  // The subcategory is the more specific row, so products point there when
  // they have one; the parent category id still resolves them via the
  // categories.parent_id chain for anything that lists by department.
  const categoryId = product.subcategoryId ?? product.categoryId ?? null;
  const brandId = product.brand ? brandIdByName.get(product.brand) : null;

  lines.push(
    "INSERT OR IGNORE INTO products (id, seller_id, category_id, brand_id, name, slug, sku, " +
      "hero_headline, hero_subtitle, status, price, old_price, currency, is_featured, " +
      "is_best_seller, rating_avg, rating_count) VALUES (" +
      [
        q(product.id),
        "NULL",
        q(categoryId),
        q(brandId ?? null),
        q(product.name),
        q(product.id),
        q(`ZUP-${product.id.toUpperCase()}`),
        q(product.heroHeadline ?? null),
        q(product.heroSubtitle ?? null),
        q("active"),
        q(product.price),
        q(product.oldPrice ?? 0),
        q("BDT"),
        q(Boolean(product.bestSeller)),
        q(Boolean(product.bestSeller)),
        q(product.rating ?? 0),
        q(product.reviews ?? 0),
      ].join(", ") +
      ");"
  );

  lines.push(
    "INSERT OR IGNORE INTO product_images (id, product_id, url, sort_order, is_primary) VALUES " +
      `(${q(`${product.id}-img-1`)}, ${q(product.id)}, ${q(product.image)}, 0, 1);`
  );

  // Every product gets at least one variant -- that is what carries stock.
  const colors = product.colors?.length ? product.colors : [null];
  colors.forEach((color, index) => {
    const variantId = `${product.id}-v${index + 1}`;
    lines.push(
      "INSERT OR IGNORE INTO product_variants (id, product_id, sku, option1_name, option1_value, " +
        "swatch, price, old_price, stock_quantity, is_active) VALUES (" +
        [
          q(variantId),
          q(product.id),
          q(`ZUP-${product.id.toUpperCase()}-${index + 1}`),
          color ? q("Color") : "NULL",
          color ? q(color.name) : "NULL",
          color ? q(color.swatch) : "NULL",
          "NULL", // inherit products.price
          "NULL",
          q(DEFAULT_STOCK),
          "1",
        ].join(", ") +
        ");"
    );
  });

  (product.features ?? []).forEach((feature, index) => {
    lines.push(
      "INSERT OR IGNORE INTO product_features (id, product_id, icon, label, sort_order) VALUES " +
        `(${q(`${product.id}-f${index + 1}`)}, ${q(product.id)}, ${q(feature.icon)}, ${q(feature.label)}, ${index});`
    );
  });

  lines.push("");
}

/* -- Platform settings ---------------------------------------------------- */
lines.push("-- Baseline platform settings, editable later from an admin panel");
const settings = {
  currency: "BDT",
  currency_symbol: "৳",
  default_commission_rate: "10",
  points_per_taka: "0.02", // 1 point per 50 Taka, matching calcPointsEarned()
  free_shipping_threshold: "0",
  standard_shipping_fee: "80",
  express_shipping_fee: "120",
  seller_signup_open: "1",
  reviews_require_purchase: "0",
};
for (const [key, value] of Object.entries(settings)) {
  lines.push(`INSERT OR IGNORE INTO site_settings (key, value) VALUES (${q(key)}, ${q(value)});`);
}
lines.push("");

fs.writeFileSync(path.join(root, "db/seed.sql"), lines.join("\n"), "utf8");
console.log(
  `Wrote db/seed.sql -- ${categories.length} categories, ${brandNames.length} brands, ${products.length} products.`
);
