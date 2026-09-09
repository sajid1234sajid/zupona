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
  };
}

/** Every column a product card needs, plus the parent join that separates
 * department from subcategory. */
const CARD_SELECT = `
  SELECT p.id, p.name, p.price, p.old_price, p.rating_avg, p.rating_count,
         p.is_best_seller, p.category_id, c.parent_id,
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
const CATALOG_TTL_SECONDS = 15;
const CATEGORY_TTL_SECONDS = 60;

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
        category_name: string | null;
        brand_name: string | null;
      }
    >();

  if (!row) return null;

  const [images, videos, variants, features, attributes] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        "SELECT url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC"
      )
      .bind(id),
    db
      .prepare(
        "SELECT url, poster_url FROM product_videos WHERE product_id = ? ORDER BY sort_order ASC"
      )
      .bind(id),
    db
      .prepare(
        `SELECT option1_value, swatch FROM product_variants
         WHERE product_id = ? AND is_active = 1 AND option1_value IS NOT NULL
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
  };
}

export async function getStoreProduct(id: string): Promise<StoreProduct | null> {
  return cached(CacheKeys.product(id), () => queryProduct(id), CATALOG_TTL_SECONDS);
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
  product_count: number;
}

async function queryCategories(): Promise<StoreCategory[]> {
  const db = await getDB();

  const { results } = await db
    .prepare(
      `SELECT c.id, c.parent_id, c.name, c.subtitle, c.image_url, c.sort_order,
              (SELECT COUNT(*) FROM products p
                WHERE p.status = 'active'
                  AND (p.category_id = c.id
                       OR p.category_id IN (SELECT id FROM categories WHERE parent_id = c.id)))
                AS product_count
       FROM categories c
       WHERE c.is_active = 1
       ORDER BY c.sort_order ASC, c.name ASC`
    )
    .all<CategoryRow>();

  const departments = results.filter((row) => row.parent_id === null);

  return departments.map((department) => ({
    id: department.id,
    name: department.name,
    subtitle: department.subtitle,
    image: department.image_url ?? PLACEHOLDER_IMAGE,
    accent: CATEGORY_ACCENTS[department.id] ?? FALLBACK_ACCENT,
    productCount: department.product_count,
    subcategories: results
      .filter((row) => row.parent_id === department.id)
      .map((row) => ({
        id: row.id,
        name: row.name,
        image: row.image_url ?? PLACEHOLDER_IMAGE,
        productCount: row.product_count,
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

/** Single-product lookup for the cart and wishlist server actions. */
export async function getStoreProductCard(id: string): Promise<StoreProductCard | null> {
  const map = await getStoreProductsByIds([id]);
  return map.get(id) ?? null;
}
