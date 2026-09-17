/** The storefront's read layer, backed by D1.
 *
 * The shop used to render from the hardcoded arrays in `src/data/`, which
 * meant nothing done in the admin panel ever reached a customer. This module
 * replaces that source. It deliberately returns the same *shapes* the existing
 * components already expect, so the change is one of data source rather than a
 * rewrite of the UI.
 *
 * Two things differ from the static catalog by necessity:
 *
 *  - Feature badges carry an icon *name* (`"Droplets"`) rather than a lucide
 *    component, because a function cannot cross the server/client boundary.
 *    `resolveIcon()` in src/components/product/featureIcons.ts maps it back.
 *  - `categoryId` is always the department and `subcategoryId` the level below
 *    it. In the database a product points at whichever is deepest, so both are
 *    derived from a join to the category's parent.
 *
 * Reads go through the KV cache, which admin writes clear via
 * `invalidateCatalog()`. That is what makes an edit show up on the shop. */

import { getDB } from "@/lib/db";
import { CacheKeys, cached } from "@/lib/cache";

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

export interface StoreProductCard {
  id: string;
  name: string;
  image: string;
  price: number;
  oldPrice: number;
  discountPercent: number;
  rating: number;
  reviews: number;
  /** Top-level department. */
  categoryId: string | null;
  /** The level below the department, when the product is filed under one. */
  subcategoryId: string | null;
  bestSeller: boolean;
  inStock: boolean;
  /** Ticked "Featured" in the admin panel; the home page leads with these. */
  featured: boolean;
}

export interface StoreProductVideo {
  url: string;
  /** Still frame to show before playback; falls back to the first product
   * image when the upload produced no poster. */
  poster: string;
}

export interface StoreProductColor {
  name: string;
  swatch: string;
}

/** One image or clip, in the single ordered list the product gallery walks.
 *
 * `images` and `videos` below stay as they are and still feed the current
 * gallery; this is the unified list, with the ids a variant can point at and
 * the alt text a separate array of URLs had nowhere to keep. */
export interface StoreMediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  /** The still to show before a clip plays. For an image, the image itself. */
  poster: string;
  alt: string;
}

export interface StoreOptionValue {
  id: string;
  /** What a variant stores, e.g. "Black & Gold" or "XL". */
  value: string;
  label: string;
  /** Hex or a CSS gradient, carried over from the old `swatch` column. */
  colorHex: string | null;
  imageUrl: string | null;
}

/** One option a product offers. A product has as many of these as it has --
 * a watch one, a shirt two, a phone Storage and Colour -- and a product with
 * none returns an empty array, which is what stops an empty selector from
 * being drawn. */
export interface StoreOptionGroup {
  id: string;
  key: string;
  name: string;
  display: "swatch" | "image" | "pill" | "dropdown";
  /** Whether the value name is printed under a swatch. */
  showLabels: boolean;
  values: StoreOptionValue[];
}

/** A sellable combination: what it costs, what is left, and which picture it
 * belongs to. Stock and price are read here, on the server, so nothing about
 * either has to be believed from the browser. */
export interface StoreVariant {
  id: string;
  /** Group key to option value, e.g. `{ color: "Black & Gold", size: "M" }`. */
  optionValues: Record<string, string>;
  /** The variant's own price, or the product's where it has none -- the
   * `effectivePrice` DATABASE.md asks callers to read rather than `price`. */
  price: number;
  compareAtPrice: number;
  /** stock_quantity minus what is already held, never below zero. */
  available: number;
  /** The product image this variant switches the gallery to, if any. */
  imageId: string | null;
}

export interface StoreProduct extends StoreProductCard {
  slug: string;
  brand: string | null;
  description: string | null;
  heroHeadline: string | null;
  heroSubtitle: string | null;
  images: string[];
  /** Demo clips, in the order the admin arranged them. Kept separate from
   * `images` so nothing that expects an <Image> src is ever handed a video. */
  videos: StoreProductVideo[];
  colors: StoreProductColor[];
  /** Icon *names*, resolved to components in the browser. */
  features: { icon: string; label: string }[];
  attributes: { name: string; value: string }[];
  categoryName: string | null;
  stockTotal: number;

  /* The dynamic option system. Everything above this line is unchanged and
   * still feeds the existing product page; everything below is additive.
   *
   * Note for callers: product JSON is served out of KV, so for up to the
   * cache TTL after a deploy these can be missing from an entry written
   * before they existed. Read them as `product.optionGroups ?? []`, the same
   * way `videos` already is. */
  /** The attribute line under the title, e.g. "Premium Cotton | Regular Fit". */
  shortDescription: string | null;
  /** Hero badge: "Best Seller", "Popular", "New Arrival". */
  badgeLabel: string | null;
  returnPolicy: string | null;
  warranty: string | null;
  soldCount: number;
  /** Images then clips, in one list -- the order the reference designs show,
   * with the video last in the thumbnail strip. */
  media: StoreMediaItem[];
  optionGroups: StoreOptionGroup[];
  variants: StoreVariant[];
}

export interface StoreSubcategory {
  id: string;
  name: string;
  image: string;
  productCount: number;
}

export interface StoreCategory {
  id: string;
  name: string;
  subtitle: string | null;
  image: string;
  accent: string;
  productCount: number;
  subcategories: StoreSubcategory[];
}

/* -------------------------------------------------------------------------- */
/* Presentation constants                                                     */
/* -------------------------------------------------------------------------- */

/** Department accent colours.
 *
 * Styling rather than content, so it stays in code: a category invented in the
 * admin panel simply falls back to the brand green instead of requiring a
 * colour to be picked before it can be used. */
const CATEGORY_ACCENTS: Record<string, string> = {
  "mens-fashion": "#1d4ed8",
  "womens-fashion": "#db2777",
  "mens-accessories": "#0f766e",
  "womens-accessories": "#9333ea",
  "baby-products": "#f59e0b",
  "health-beauty": "#16a34a",
  electronics: "#0ea5e9",
  "body-bath": "#14b8a6",
};

const FALLBACK_ACCENT = "#16a34a";

/** Shown when a product or category has no image of its own, so a missing
 * upload never renders as a broken tile. */
const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=70";

/* -------------------------------------------------------------------------- */
/* Row shapes & mapping                                                       */
/* -------------------------------------------------------------------------- */

interface CardRow {
  id: string;
  name: string;
  price: number;
  old_price: number;
  rating_avg: number;
  rating_count: number;
  is_best_seller: number;
  image: string | null;
  category_id: string | null;
  parent_id: string | null;
  stock_total: number | null;
  is_featured: number;
}

function discountPercent(price: number, oldPrice: number): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

function toCard(row: CardRow): StoreProductCard {
  // A product points at its deepest category. When that category has a parent,
  // the parent is the department and the category itself is the subcategory.
  const isSub = row.parent_id !== null;

  return {
    id: row.id,
    name: row.name,
    image: row.image ?? PLACEHOLDER_IMAGE,
    price: row.price,
    oldPrice: row.old_price,
    discountPercent: discountPercent(row.price, row.old_price),
    rating: row.rating_avg,
    reviews: row.rating_count,
    categoryId: isSub ? row.parent_id : row.category_id,
    subcategoryId: isSub ? row.category_id : null,
    bestSeller: row.is_best_seller === 1,
    inStock: (row.stock_total ?? 0) > 0,
    featured: row.is_featured === 1,
  };
}

/** Every column a product card needs, plus the parent join that separates
 * department from subcategory. */
const CARD_SELECT = `
  SELECT p.id, p.name, p.price, p.old_price, p.rating_avg, p.rating_count,
         p.is_best_seller, p.is_featured, p.category_id, c.parent_id,
         (SELECT url FROM product_images i WHERE i.product_id = p.id
           ORDER BY i.is_primary DESC, i.sort_order ASC LIMIT 1) AS image,
         (SELECT COALESCE(SUM(v.stock_quantity - v.reserved_quantity), 0)
            FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1)
           AS stock_total
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id`;

/* -------------------------------------------------------------------------- */
/* Product listing                                                            */
/* -------------------------------------------------------------------------- */

export type StoreSort =
  | "popular"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "discount";

const SORT_SQL: Record<StoreSort, string> = {
  popular: "p.sold_count DESC, p.rating_count DESC, p.rating_avg DESC",
  newest: "p.created_at DESC",
  price_asc: "p.price ASC",
  price_desc: "p.price DESC",
  rating: "p.rating_avg DESC, p.rating_count DESC",
  // A CASE rather than a stored column: the discount is derived, and storing
  // it would be one more thing that can fall out of step with the price.
  discount:
    "CASE WHEN p.old_price > p.price THEN (p.old_price - p.price) * 100.0 / p.old_price ELSE 0 END DESC",
};

export interface StoreQuery {
  /** Matches the department and everything filed beneath it. */
  categoryId?: string;
  subcategoryId?: string;
  sort?: StoreSort;
  minDiscount?: number;
  maxPrice?: number;
  featuredOnly?: boolean;
  limit?: number;
}

/** Only `active` products are ever shown. A draft or archived product is
 * invisible to shoppers the moment its status changes in the admin panel. */
function buildWhere(query: StoreQuery): { where: string; binds: unknown[] } {
  const clauses = ["p.status = 'active'"];
  const binds: unknown[] = [];

  if (query.categoryId) {
    clauses.push("(p.category_id = ? OR c.parent_id = ?)");
    binds.push(query.categoryId, query.categoryId);
  }
  if (query.subcategoryId) {
    clauses.push("p.category_id = ?");
    binds.push(query.subcategoryId);
  }
  if (query.featuredOnly) clauses.push("p.is_featured = 1");
  if (typeof query.maxPrice === "number") {
    clauses.push("p.price <= ?");
    binds.push(query.maxPrice);
  }
  if (typeof query.minDiscount === "number" && query.minDiscount > 0) {
    clauses.push(
      "p.old_price > p.price AND (p.old_price - p.price) * 100.0 / p.old_price >= ?"
    );
    binds.push(query.minDiscount);
  }

  return { where: `WHERE ${clauses.join(" AND ")}`, binds };
}

async function queryCards(query: StoreQuery): Promise<StoreProductCard[]> {
  const db = await getDB();
  const { where, binds } = buildWhere(query);
  const order = SORT_SQL[query.sort ?? "popular"];
  const limit = Math.min(query.limit ?? 200, 500);

  const { results } = await db
    .prepare(`${CARD_SELECT} ${where} ORDER BY ${order} LIMIT ?`)
    .bind(...binds, limit)
    .all<CardRow>();

  return results.map(toCard);
}

/** How long a catalog read may be served from KV.
 *
 * Admin writes call `invalidateCatalog()`, so in the normal case an edit is
 * visible immediately. The TTL only matters when that clear is missed -- KV
 * listing is eventually consistent, so a key written moments earlier can be
 * absent from the list. Keeping it short means the worst case is a few stale
 * seconds rather than a shopkeeper reloading and wondering why their price
 * change has not appeared. */
const CATALOG_TTL_SECONDS = 120;
const CATEGORY_TTL_SECONDS = 600;

/** The whole shoppable catalog.
 *
 * The home page filters this in the browser, so it is fetched once rather than
 * re-queried per chip. */
export async function listStoreProducts(query: StoreQuery = {}): Promise<StoreProductCard[]> {
  const fingerprint = JSON.stringify(query);
  return cached(CacheKeys.productList(fingerprint), () => queryCards(query), CATALOG_TTL_SECONDS);
}

/* -------------------------------------------------------------------------- */
/* Single product                                                             */
/* -------------------------------------------------------------------------- */

async function queryProduct(id: string): Promise<StoreProduct | null> {
  const db = await getDB();

  const row = await db
    .prepare(
      `SELECT p.id, p.name, p.price, p.old_price, p.rating_avg, p.rating_count,
              p.is_best_seller, p.category_id, p.slug, p.description,
              p.hero_headline, p.hero_subtitle,
              p.short_description, p.badge_label, p.return_policy, p.warranty,
              -- Units actually ordered. products.sold_count is never written by
              -- checkout, so it would read 0 on every product.
              (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi
                 JOIN orders o ON o.id = oi.order_id
                WHERE oi.product_id = p.id AND o.status != 'cancelled') AS sold_count,
              c.parent_id, c.name AS category_name, b.name AS brand_name,
              (SELECT url FROM product_images i WHERE i.product_id = p.id
                ORDER BY i.is_primary DESC, i.sort_order ASC LIMIT 1) AS image,
              (SELECT COALESCE(SUM(v.stock_quantity - v.reserved_quantity), 0)
                 FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1)
                AS stock_total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE p.id = ? AND p.status = 'active'`
    )
    .bind(id)
    .first<
      CardRow & {
        slug: string;
        description: string | null;
        hero_headline: string | null;
        hero_subtitle: string | null;
        short_description: string | null;
        badge_label: string | null;
        return_policy: string | null;
        warranty: string | null;
        sold_count: number;
        category_name: string | null;
        brand_name: string | null;
      }
    >();

  if (!row) return null;

  // `variants` here is the *colour* list the existing gallery uses, not the
  // sellable variants added below -- it is left exactly as it was.
  const [images, videos, variants, features, attributes, optionRows, sellable, sellableOptions] =
    await db.batch<Record<string, unknown>>([
    db
      .prepare(
        "SELECT id, url, alt FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC"
      )
      .bind(id),
    db
      .prepare(
        "SELECT id, url, poster_url, alt FROM product_videos WHERE product_id = ? ORDER BY sort_order ASC"
      )
      .bind(id),
    // The legacy colour list. Retired options are filtered here too: the old
    // page reads this and nothing else, so without it a colour the admin has
    // turned off would disappear from /products/<slug> and still be offered on
    // /product/<id>.
    db
      .prepare(
        `SELECT option1_value, swatch FROM product_variants v
         WHERE product_id = ? AND is_active = 1 AND option1_value IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM product_variant_options o
             JOIN product_option_groups g ON g.id = o.group_id
             JOIN product_option_values ov ON ov.id = o.value_id
             WHERE o.variant_id = v.id AND (g.is_active = 0 OR ov.is_active = 0)
           )
         ORDER BY rowid ASC`
      )
      .bind(id),
    db
      .prepare("SELECT icon, label FROM product_features WHERE product_id = ? ORDER BY sort_order ASC")
      .bind(id),
    db
      .prepare(
        `SELECT attr_name, attr_value FROM product_attributes
         WHERE product_id = ? AND attr_name != 'tag' ORDER BY sort_order ASC`
      )
      .bind(id),
    // Option groups with their values. An inner join, so a group that somehow
    // has no values never reaches the page as an empty selector. A retired
    // group or value is not offered at all: it is dropped here rather than
    // rendered and disabled, because it is gone rather than sold out.
    db
      .prepare(
        `SELECT g.id AS group_id, g.key, g.name, g.display, g.show_labels,
                ov.id AS value_id, ov.value, ov.label, ov.color_hex, ov.image_url
         FROM product_option_groups g
         JOIN product_option_values ov ON ov.group_id = g.id
         WHERE g.product_id = ? AND g.is_active = 1 AND ov.is_active = 1
         ORDER BY g.sort_order ASC, ov.sort_order ASC`
      )
      .bind(id),
    // The sellable combinations, with the price and stock the server decides.
    // A variant is excluded when any option it carries has been retired, so a
    // combination can never outlive the value that named it -- the admin
    // deactivates those variants too, and this is the second lock on it.
    db
      .prepare(
        `SELECT id, price, old_price, stock_quantity, reserved_quantity, image_id
         FROM product_variants v
         WHERE product_id = ? AND is_active = 1
           AND NOT EXISTS (
             SELECT 1 FROM product_variant_options o
             JOIN product_option_groups g ON g.id = o.group_id
             JOIN product_option_values ov ON ov.id = o.value_id
             WHERE o.variant_id = v.id AND (g.is_active = 0 OR ov.is_active = 0)
           )
         ORDER BY rowid ASC`
      )
      .bind(id),
    // Which value each variant carries, keyed by group so the page can match
    // a selection without knowing anything about the option names.
    db
      .prepare(
        `SELECT pvo.variant_id, g.key AS group_key, ov.value
         FROM product_variant_options pvo
         JOIN product_option_groups g ON g.id = pvo.group_id
         JOIN product_option_values ov ON ov.id = pvo.value_id
         WHERE g.product_id = ? AND g.is_active = 1 AND ov.is_active = 1`
      )
      .bind(id),
  ]);

  const imageUrls = (images.results as unknown as { url: string }[]).map((i) => i.url);

  // Several size variants share a colour, so the swatch list is de-duplicated
  // rather than showing "Black" three times.
  const colors: StoreProductColor[] = [];
  const seenColors = new Set<string>();
  for (const variant of variants.results as unknown as {
    option1_value: string | null;
    swatch: string | null;
  }[]) {
    const name = variant.option1_value;
    if (!name || seenColors.has(name)) continue;
    seenColors.add(name);
    colors.push({ name, swatch: variant.swatch ?? "#e5e7eb" });
  }

  const card = toCard(row);

  /* ------------------------------------------------------------------ */
  /* The dynamic option system                                          */
  /* ------------------------------------------------------------------ */

  // One ordered list: the stills first, then the clips. That is the order the
  // reference designs show, with the video sitting last in the thumbnail
  // strip. `images` and `videos` above keep their own order for the existing
  // gallery, which leads with clips.
  const media: StoreMediaItem[] = [
    ...(images.results as unknown as { id: string; url: string; alt: string | null }[]).map(
      (image) => ({
        id: image.id,
        type: "image" as const,
        url: image.url,
        poster: image.url,
        alt: image.alt ?? row.name,
      })
    ),
    ...(
      videos.results as unknown as {
        id: string;
        url: string;
        poster_url: string | null;
        alt: string | null;
      }[]
    ).map((video) => ({
      id: video.id,
      type: "video" as const,
      url: video.url,
      poster: video.poster_url ?? imageUrls[0] ?? card.image,
      alt: video.alt ?? row.name,
    })),
  ];

  // A product with no uploaded media still needs something for the gallery to
  // draw, the same way `images` falls back to the placeholder rather than
  // handing the page an empty array.
  if (media.length === 0) {
    media.push({ id: `${row.id}-placeholder`, type: "image", url: card.image, poster: card.image, alt: row.name });
  }

  // Groups arrive flattened, one row per value, already in display order.
  const groupsById = new Map<string, StoreOptionGroup>();
  for (const optionRow of optionRows.results as unknown as {
    group_id: string;
    key: string;
    name: string;
    display: string;
    show_labels: number;
    value_id: string;
    value: string;
    label: string;
    color_hex: string | null;
    image_url: string | null;
  }[]) {
    let group = groupsById.get(optionRow.group_id);
    if (!group) {
      group = {
        id: optionRow.group_id,
        key: optionRow.key,
        name: optionRow.name,
        display: optionRow.display as StoreOptionGroup["display"],
        showLabels: optionRow.show_labels === 1,
        values: [],
      };
      groupsById.set(optionRow.group_id, group);
    }
    group.values.push({
      id: optionRow.value_id,
      value: optionRow.value,
      label: optionRow.label,
      colorHex: optionRow.color_hex,
      imageUrl: optionRow.image_url,
    });
  }
  const optionGroups = [...groupsById.values()];

  // A variant's selections, gathered before the variants themselves so each
  // one can be handed a finished map.
  const selectionsByVariant = new Map<string, Record<string, string>>();
  for (const link of sellableOptions.results as unknown as {
    variant_id: string;
    group_key: string;
    value: string;
  }[]) {
    const selections = selectionsByVariant.get(link.variant_id) ?? {};
    selections[link.group_key] = link.value;
    selectionsByVariant.set(link.variant_id, selections);
  }

  const sellableVariants: StoreVariant[] = (
    sellable.results as unknown as {
      id: string;
      price: number | null;
      old_price: number | null;
      stock_quantity: number;
      reserved_quantity: number;
      image_id: string | null;
    }[]
  ).map((variant) => ({
    id: variant.id,
    optionValues: selectionsByVariant.get(variant.id) ?? {},
    // NULL means "inherit the product price", which is why this is not read
    // as `variant.price` anywhere.
    price: variant.price ?? row.price,
    compareAtPrice: variant.old_price ?? row.old_price,
    available: Math.max(0, variant.stock_quantity - variant.reserved_quantity),
    imageId: variant.image_id,
  }));

  return {
    ...card,
    image: imageUrls[0] ?? card.image,
    images: imageUrls.length > 0 ? imageUrls : [card.image],
    videos: (videos.results as unknown as { url: string; poster_url: string | null }[]).map(
      (video) => ({
        url: video.url,
        poster: video.poster_url ?? imageUrls[0] ?? card.image,
      })
    ),
    slug: row.slug,
    brand: row.brand_name,
    description: row.description,
    heroHeadline: row.hero_headline,
    heroSubtitle: row.hero_subtitle,
    categoryName: row.category_name,
    colors,
    features: (features.results as unknown as { icon: string; label: string }[]).map((f) => ({
      icon: f.icon,
      label: f.label,
    })),
    attributes: (attributes.results as unknown as {
      attr_name: string;
      attr_value: string;
    }[]).map((a) => ({ name: a.attr_name, value: a.attr_value })),
    stockTotal: row.stock_total ?? 0,
    shortDescription: row.short_description,
    badgeLabel: row.badge_label,
    returnPolicy: row.return_policy,
    warranty: row.warranty,
    soldCount: row.sold_count ?? 0,
    media,
    optionGroups,
    variants: sellableVariants,
  };
}

export async function getStoreProduct(id: string): Promise<StoreProduct | null> {
  return cached(CacheKeys.product(id), () => queryProduct(id), CATALOG_TTL_SECONDS);
}

/** Resolves the public `/products/<slug>` URL to a product.
 *
 * The slug is looked up on its own and the product then loaded by id, so both
 * URL shapes share one cache entry instead of caching the same product twice.
 * Only active products resolve, so an unpublished one 404s rather than being
 * reachable by anyone who remembers the address. */
export async function getStoreProductBySlug(slug: string): Promise<StoreProduct | null> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT id FROM products WHERE slug = ? AND status = 'active'")
    .bind(slug)
    .first<{ id: string }>();

  if (!row) return null;
  return getStoreProduct(row.id);
}

/** Ids only, for `generateStaticParams` and for cheap existence checks. */
export async function listStoreProductIds(): Promise<string[]> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT id FROM products WHERE status = 'active'")
    .all<{ id: string }>();
  return results.map((row) => row.id);
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

interface CategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  subtitle: string | null;
  image_url: string | null;
  sort_order: number;
  own_count: number;
}

async function queryCategories(): Promise<StoreCategory[]> {
  const db = await getDB();

  // The counts used to be a correlated COUNT(*) per category, each one
  // re-scanning products and the category table. On a catalog of forty
  // products that read nearly three thousand rows per call and was, on its
  // own, most of a day's D1 row budget. Counting every category once in a
  // grouped join and rolling the children up in JS reads the two tables a
  // single time and gives exactly the same numbers.
  const { results } = await db
    .prepare(
      `SELECT c.id, c.parent_id, c.name, c.subtitle, c.image_url, c.sort_order,
              COALESCE(counts.n, 0) AS own_count
       FROM categories c
       LEFT JOIN (SELECT category_id, COUNT(*) AS n
                    FROM products
                   WHERE status = 'active'
                   GROUP BY category_id) counts
         ON counts.category_id = c.id
       WHERE c.is_active = 1
       ORDER BY c.sort_order ASC, c.name ASC`
    )
    .all<CategoryRow>();

  // A category's total is its own products plus those of its children, which
  // is what the old subquery's OR clause meant.
  const childTotals = new Map<string, number>();
  for (const row of results) {
    if (row.parent_id === null) continue;
    childTotals.set(row.parent_id, (childTotals.get(row.parent_id) ?? 0) + row.own_count);
  }
  const totalFor = (row: CategoryRow) => row.own_count + (childTotals.get(row.id) ?? 0);

  const departments = results.filter((row) => row.parent_id === null);

  return departments.map((department) => ({
    id: department.id,
    name: department.name,
    subtitle: department.subtitle,
    image: department.image_url ?? PLACEHOLDER_IMAGE,
    accent: CATEGORY_ACCENTS[department.id] ?? FALLBACK_ACCENT,
    productCount: totalFor(department),
    subcategories: results
      .filter((row) => row.parent_id === department.id)
      .map((row) => ({
        id: row.id,
        name: row.name,
        image: row.image_url ?? PLACEHOLDER_IMAGE,
        productCount: totalFor(row),
      })),
  }));
}

export async function listStoreCategories(): Promise<StoreCategory[]> {
  return cached(CacheKeys.categories(), queryCategories, CATEGORY_TTL_SECONDS);
}

export async function getStoreCategory(id: string): Promise<StoreCategory | undefined> {
  const categories = await listStoreCategories();
  return categories.find((category) => category.id === id);
}

export async function getStoreSubcategory(
  categoryId: string,
  subcategoryId: string
): Promise<StoreSubcategory | undefined> {
  const category = await getStoreCategory(categoryId);
  return category?.subcategories.find((sub) => sub.id === subcategoryId);
}

/* -------------------------------------------------------------------------- */
/* Category browsing extras                                                   */
/* -------------------------------------------------------------------------- */

export interface StoreCategoryOverview extends StoreCategory {
  bestDiscount: number;
  fromPrice: number | null;
  highlights: StoreProductCard[];
}

/** Everything the /categories browser needs, in two queries rather than one
 * per department. */
export async function listCategoryOverviews(
  highlightCount = 6
): Promise<StoreCategoryOverview[]> {
  const db = await getDB();
  const categories = await listStoreCategories();

  const { results: stats } = await db
    .prepare(
      `SELECT COALESCE(parent.id, c.id) AS department,
              MIN(p.price) AS from_price,
              MAX(CASE WHEN p.old_price > p.price
                       THEN (p.old_price - p.price) * 100.0 / p.old_price ELSE 0 END)
                AS best_discount
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN categories parent ON parent.id = c.parent_id
       WHERE p.status = 'active'
       GROUP BY department`
    )
    .all<{ department: string; from_price: number | null; best_discount: number | null }>();

  const byDepartment = new Map(stats.map((row) => [row.department, row]));

  return Promise.all(
    categories.map(async (category) => {
      const stat = byDepartment.get(category.id);
      return {
        ...category,
        bestDiscount: Math.round(stat?.best_discount ?? 0),
        fromPrice: stat?.from_price ?? null,
        highlights: await listStoreProducts({
          categoryId: category.id,
          sort: "popular",
          limit: highlightCount,
        }),
      };
    })
  );
}

/* -------------------------------------------------------------------------- */
/* Lookups used by cart, wishlist and orders                                  */
/* -------------------------------------------------------------------------- */

/** Resolves a set of product ids in one query.
 *
 * The cart and wishlist hold ids and need names, images and today's price to
 * render -- and to notice a price drop. Missing ids are simply absent from the
 * map, which is how a product archived since it was saved gets dropped from
 * the list rather than rendering blank. */
export async function getStoreProductsByIds(
  ids: string[]
): Promise<Map<string, StoreProductCard>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const db = await getDB();
  const placeholders = unique.map(() => "?").join(",");

  const { results } = await db
    .prepare(`${CARD_SELECT} WHERE p.id IN (${placeholders}) AND p.status = 'active'`)
    .bind(...unique)
    .all<CardRow>();

  return new Map(results.map((row) => [row.id, toCard(row)]));
}

/** Products a shopper already holds a reference to, whatever their status.
 *
 * `getStoreProductsByIds` above deliberately returns only active products, and
 * every listing depends on that. But a cart line is not a listing: it is a
 * reference the shopper made when the product *was* on sale, and archiving the
 * product is not a reason for their line to disappear without a word. This
 * looks one up so the line can still be drawn -- and then be marked as no
 * longer available.
 *
 * Only ever call this for ids that are already referenced somewhere. It has no
 * status filter, so using it to build a listing would put archived products
 * back on the storefront. */
export async function getReferencedProductsByIds(
  ids: string[]
): Promise<Map<string, StoreProductCard>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const db = await getDB();
  const placeholders = unique.map(() => "?").join(",");

  const { results } = await db
    .prepare(`${CARD_SELECT} WHERE p.id IN (${placeholders})`)
    .bind(...unique)
    .all<CardRow>();

  return new Map(results.map((row) => [row.id, toCard(row)]));
}

/** Single-product lookup for the cart and wishlist server actions. */
export async function getStoreProductCard(id: string): Promise<StoreProductCard | null> {
  const map = await getStoreProductsByIds([id]);
  return map.get(id) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Banners                                                                    */
/* -------------------------------------------------------------------------- */

/** A merchandising banner as the storefront needs it.
 *
 * The admin panel's own `Banner` type in `src/lib/adminData.ts` carries the
 * scheduling and visibility columns because the panel has to show them. By the
 * time a banner reaches a shopper those questions are already settled, so this
 * shape is only what gets drawn. */
export interface StoreBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image: string | null;
  href: string | null;
}

async function queryBanners(placement: string): Promise<StoreBanner[]> {
  const db = await getDB();

  // The schedule is applied here rather than in the component: a banner whose
  // window has closed should stop being drawn on its own, without an admin
  // remembering to switch it off. A NULL bound means "no limit that side".
  const { results } = await db
    .prepare(
      `SELECT id, title, subtitle, image_url, link_url
         FROM banners
        WHERE placement = ?
          AND is_active = 1
          AND (starts_at IS NULL OR starts_at <= datetime('now'))
          AND (ends_at IS NULL OR ends_at >= datetime('now'))
        ORDER BY sort_order ASC, created_at DESC`
    )
    .bind(placement)
    .all<{
      id: string;
      title: string;
      subtitle: string | null;
      image_url: string | null;
      link_url: string | null;
    }>();

  return results.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    image: row.image_url,
    href: row.link_url,
  }));
}

/** Banners published for one storefront slot, soonest in sort order first.
 *
 * Cached under the `catalog:` prefix so publishing, hiding or deleting a
 * banner in the admin panel clears it through the same `invalidateCatalog()`
 * every other merchandising write already calls. */
export async function listStoreBanners(placement: string): Promise<StoreBanner[]> {
  return cached(
    CacheKeys.banners(placement),
    () => queryBanners(placement),
    CATALOG_TTL_SECONDS
  );
}
