/** Read/write access to the product catalog: categories, brands, products,
 * variants, images and feature badges.
 *
 * Prices are whole Taka everywhere (see `formatPrice` in src/lib/format.ts).
 * A variant's `price` column is NULL when it inherits the parent product's
 * price, so callers should use `effectivePrice` rather than `variant.price`. */

import { getDB } from "@/lib/db";
import type {
  CatalogBrand,
  CatalogCategory,
  CatalogProduct,
  CatalogVariant,
  ProductSort,
  ProductStatus,
} from "@/types";

/* -------------------------------------------------------------------------- */
/* Row shapes                                                                 */
/* -------------------------------------------------------------------------- */

interface ProductRow {
  id: string;
  seller_id: string | null;
  category_id: string | null;
  brand_id: string | null;
  brand_name: string | null;
  category_name: string | null;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  hero_headline: string | null;
  hero_subtitle: string | null;
  status: ProductStatus;
  price: number;
  old_price: number;
  currency: string;
  is_featured: number;
  is_best_seller: number;
  rating_avg: number;
  rating_count: number;
  sold_count: number;
  view_count: number;
  primary_image: string | null;
  stock_total: number | null;
}

interface VariantRow {
  id: string;
  product_id: string;
  sku: string | null;
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
  swatch: string | null;
  price: number | null;
  old_price: number | null;
  stock_quantity: number;
  reserved_quantity: number;
  image_url: string | null;
  is_active: number;
}

/** Product columns plus the joins every product view needs: brand/category
 * names, the primary image, and summed stock across variants. */
const PRODUCT_SELECT = `
  SELECT p.id, p.seller_id, p.category_id, p.brand_id, p.name, p.slug, p.sku,
         p.description, p.hero_headline, p.hero_subtitle, p.status, p.price,
         p.old_price, p.currency, p.is_featured, p.is_best_seller, p.rating_avg,
         p.rating_count, p.sold_count, p.view_count,
         b.name AS brand_name,
         c.name AS category_name,
         (SELECT url FROM product_images i WHERE i.product_id = p.id
           ORDER BY i.is_primary DESC, i.sort_order ASC LIMIT 1) AS primary_image,
         (SELECT COALESCE(SUM(v.stock_quantity - v.reserved_quantity), 0)
            FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS stock_total
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN categories c ON c.id = p.category_id`;

function discountPercent(price: number, oldPrice: number): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

function toProduct(row: ProductRow): CatalogProduct {
  return {
    id: row.id,
    sellerId: row.seller_id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    brandId: row.brand_id,
    brand: row.brand_name,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    description: row.description,
    heroHeadline: row.hero_headline,
    heroSubtitle: row.hero_subtitle,
    status: row.status,
    price: row.price,
    oldPrice: row.old_price,
    discountPercent: discountPercent(row.price, row.old_price),
    currency: row.currency,
    isFeatured: row.is_featured === 1,
    isBestSeller: row.is_best_seller === 1,
    rating: row.rating_avg,
    reviews: row.rating_count,
    soldCount: row.sold_count,
    viewCount: row.view_count,
    image: row.primary_image,
    inStock: (row.stock_total ?? 0) > 0,
    stockTotal: row.stock_total ?? 0,
    images: [],
    variants: [],
    features: [],
    attributes: [],
  };
}

function toVariant(row: VariantRow, productPrice: number, productOldPrice: number): CatalogVariant {
  const price = row.price ?? productPrice;
  const oldPrice = row.old_price ?? productOldPrice;
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    optionName: row.option1_name,
    optionValue: row.option1_value,
    option2Name: row.option2_name,
    option2Value: row.option2_value,
    swatch: row.swatch,
    price,
    oldPrice,
    effectivePrice: price,
    stockQuantity: row.stock_quantity,
    availableQuantity: Math.max(0, row.stock_quantity - row.reserved_quantity),
    imageUrl: row.image_url,
    isActive: row.is_active === 1,
  };
}

/* -------------------------------------------------------------------------- */
/* Categories & brands                                                        */
/* -------------------------------------------------------------------------- */

export async function listCategories(parentId: string | null = null): Promise<CatalogCategory[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT id, parent_id, name, slug, subtitle, image_url, icon, sort_order
       FROM categories
       WHERE is_active = 1 AND parent_id IS ?
       ORDER BY sort_order ASC, name ASC`
    )
    .bind(parentId)
    .all<{
      id: string;
      parent_id: string | null;
      name: string;
      slug: string;
      subtitle: string | null;
      image_url: string | null;
      icon: string | null;
      sort_order: number;
    }>();

  return results.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    subtitle: row.subtitle,
    image: row.image_url,
    icon: row.icon,
    sortOrder: row.sort_order,
  }));
}

export async function listBrands(): Promise<CatalogBrand[]> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT id, name, slug, logo_url FROM brands ORDER BY name ASC")
    .all<{ id: string; name: string; slug: string; logo_url: string | null }>();

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
  }));
}

/* -------------------------------------------------------------------------- */
/* Product listing                                                            */
/* -------------------------------------------------------------------------- */

export interface ProductQuery {
  categoryId?: string;
  brandId?: string;
  sellerId?: string;
  search?: string;
  featured?: boolean;
  bestSeller?: boolean;
  minPrice?: number;
  maxPrice?: number;
  /** Defaults to 'active'. Pass 'any' from admin tooling to see every status. */
  status?: ProductStatus | "any";
  sort?: ProductSort;
  limit?: number;
  offset?: number;
}

const SORT_SQL: Record<ProductSort, string> = {
  newest: "p.created_at DESC",
  price_asc: "p.price ASC",
  price_desc: "p.price DESC",
  rating: "p.rating_avg DESC, p.rating_count DESC",
  popular: "p.sold_count DESC, p.view_count DESC",
};

/** Builds the shared WHERE clause for listProducts/countProducts so the two
 * can never drift apart and disagree on how many pages exist. */
function buildFilter(query: ProductQuery): { where: string; binds: unknown[] } {
  const clauses: string[] = [];
  const binds: unknown[] = [];

  const status = query.status ?? "active";
  if (status !== "any") {
    clauses.push("p.status = ?");
    binds.push(status);
  }
  if (query.categoryId) {
    clauses.push("p.category_id = ?");
    binds.push(query.categoryId);
  }
  if (query.brandId) {
    clauses.push("p.brand_id = ?");
    binds.push(query.brandId);
  }
  if (query.sellerId) {
    clauses.push("p.seller_id = ?");
    binds.push(query.sellerId);
  }
  if (query.featured) clauses.push("p.is_featured = 1");
  if (query.bestSeller) clauses.push("p.is_best_seller = 1");
  if (typeof query.minPrice === "number") {
    clauses.push("p.price >= ?");
    binds.push(query.minPrice);
  }
  if (typeof query.maxPrice === "number") {
    clauses.push("p.price <= ?");
    binds.push(query.maxPrice);
  }
  if (query.search?.trim()) {
    clauses.push("(p.name LIKE ? OR p.description LIKE ? OR b.name LIKE ?)");
    const term = `%${query.search.trim()}%`;
    binds.push(term, term, term);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", binds };
}

export async function listProducts(query: ProductQuery = {}): Promise<CatalogProduct[]> {
  const db = await getDB();
  const { where, binds } = buildFilter(query);
  const order = SORT_SQL[query.sort ?? "newest"];
  const limit = Math.min(query.limit ?? 24, 100);
  const offset = query.offset ?? 0;

  const { results } = await db
    .prepare(`${PRODUCT_SELECT} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset)
    .all<ProductRow>();

  return results.map(toProduct);
}

export async function countProducts(query: ProductQuery = {}): Promise<number> {
  const db = await getDB();
  const { where, binds } = buildFilter(query);
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id ${where}`
    )
    .bind(...binds)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function getFeaturedProducts(limit = 8): Promise<CatalogProduct[]> {
  return listProducts({ featured: true, sort: "popular", limit });
}

/** Products in the same category, excluding the one being viewed. */
export async function getRelatedProducts(productId: string, limit = 6): Promise<CatalogProduct[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `${PRODUCT_SELECT}
       WHERE p.status = 'active'
         AND p.id != ?
         AND p.category_id = (SELECT category_id FROM products WHERE id = ?)
       ORDER BY p.sold_count DESC LIMIT ?`
    )
    .bind(productId, productId, limit)
    .all<ProductRow>();
  return results.map(toProduct);
}

/* -------------------------------------------------------------------------- */
/* Single product                                                             */
/* -------------------------------------------------------------------------- */

async function hydrate(row: ProductRow): Promise<CatalogProduct> {
  const db = await getDB();
  const product = toProduct(row);

  const [images, variants, features, attributes] = await db.batch<Record<string, never>>([
    db
      .prepare("SELECT url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC")
      .bind(row.id),
    db
      .prepare("SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY rowid ASC")
      .bind(row.id),
    db
      .prepare("SELECT icon, label FROM product_features WHERE product_id = ? ORDER BY sort_order ASC")
      .bind(row.id),
    db
      .prepare("SELECT attr_name, attr_value FROM product_attributes WHERE product_id = ? ORDER BY sort_order ASC")
      .bind(row.id),
  ]);

  product.images = (images.results as unknown as { url: string }[]).map((i) => i.url);
  product.variants = (variants.results as unknown as VariantRow[]).map((v) =>
    toVariant(v, row.price, row.old_price)
  );
  product.features = (features.results as unknown as { icon: string; label: string }[]).map((f) => ({
    icon: f.icon,
    label: f.label,
  }));
  product.attributes = (attributes.results as unknown as { attr_name: string; attr_value: string }[]).map(
    (a) => ({ name: a.attr_name, value: a.attr_value })
  );

  if (!product.image && product.images.length > 0) product.image = product.images[0];
  return product;
}

export async function getProduct(id: string): Promise<CatalogProduct | null> {
  const db = await getDB();
  const row = await db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).bind(id).first<ProductRow>();
  return row ? hydrate(row) : null;
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const db = await getDB();
  const row = await db.prepare(`${PRODUCT_SELECT} WHERE p.slug = ?`).bind(slug).first<ProductRow>();
  return row ? hydrate(row) : null;
}

/* -------------------------------------------------------------------------- */
/* Search & browsing signals                                                  */
/* -------------------------------------------------------------------------- */

/** Runs a catalog search and records the query for autocomplete/analytics. */
export async function searchProducts(
  term: string,
  options: { userId?: string | null; limit?: number } = {}
): Promise<CatalogProduct[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const products = await listProducts({ search: trimmed, limit: options.limit ?? 24, sort: "popular" });

  const db = await getDB();
  await db
    .prepare("INSERT INTO search_queries (id, user_id, query, results_count) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), options.userId ?? null, trimmed.toLowerCase(), products.length)
    .run();

  return products;
}

/** Most-searched terms, for the search bar's suggestion list. */
export async function topSearchTerms(limit = 8): Promise<string[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT query, COUNT(*) AS n FROM search_queries
       WHERE results_count > 0
       GROUP BY query ORDER BY n DESC LIMIT ?`
    )
    .bind(limit)
    .all<{ query: string; n: number }>();
  return results.map((r) => r.query);
}

/** Bumps the view counter and, for signed-in shoppers, the recently-viewed list. */
export async function recordProductView(productId: string, userId: string | null): Promise<void> {
  const db = await getDB();
  const statements = [
    db.prepare("UPDATE products SET view_count = view_count + 1 WHERE id = ?").bind(productId),
  ];

  if (userId) {
    statements.push(
      db
        .prepare(
          `INSERT INTO recently_viewed (id, user_id, product_id, viewed_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT (user_id, product_id) DO UPDATE SET viewed_at = datetime('now')`
        )
        .bind(crypto.randomUUID(), userId, productId)
    );
  }

  await db.batch(statements);
}

export async function getRecentlyViewed(userId: string, limit = 10): Promise<CatalogProduct[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `${PRODUCT_SELECT}
       JOIN recently_viewed rv ON rv.product_id = p.id
       WHERE rv.user_id = ? AND p.status = 'active'
       ORDER BY rv.viewed_at DESC LIMIT ?`
    )
    .bind(userId, limit)
    .all<ProductRow>();
  return results.map(toProduct);
}

/* -------------------------------------------------------------------------- */
/* Writes (admin / seller tooling)                                            */
/* -------------------------------------------------------------------------- */

export interface ProductInput {
  name: string;
  slug: string;
  price: number;
  oldPrice?: number;
  sku?: string | null;
  description?: string | null;
  heroHeadline?: string | null;
  heroSubtitle?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  sellerId?: string | null;
  status?: ProductStatus;
  isFeatured?: boolean;
  isBestSeller?: boolean;
}

/** Creates a product together with its first variant, so it is immediately
 * sellable (stock always lives on a variant, never on the product). */
export async function createProduct(
  input: ProductInput,
  options: { initialStock?: number; imageUrl?: string | null } = {}
): Promise<string> {
  const db = await getDB();
  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();

  const statements = [
    db
      .prepare(
        `INSERT INTO products (id, seller_id, category_id, brand_id, name, slug, sku, description,
                               hero_headline, hero_subtitle, status, price, old_price,
                               is_featured, is_best_seller)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        productId,
        input.sellerId ?? null,
        input.categoryId ?? null,
        input.brandId ?? null,
        input.name,
        input.slug,
        input.sku ?? null,
        input.description ?? null,
        input.heroHeadline ?? null,
        input.heroSubtitle ?? null,
        input.status ?? "draft",
        input.price,
        input.oldPrice ?? 0,
        input.isFeatured ? 1 : 0,
        input.isBestSeller ? 1 : 0
      ),
    db
      .prepare(
        `INSERT INTO product_variants (id, product_id, sku, stock_quantity) VALUES (?, ?, ?, ?)`
      )
      .bind(variantId, productId, input.sku ? `${input.sku}-1` : null, options.initialStock ?? 0),
    db
      .prepare("INSERT INTO price_history (id, product_id, price, old_price) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), productId, input.price, input.oldPrice ?? 0),
  ];

  if (options.imageUrl) {
    statements.push(
      db
        .prepare(
          "INSERT INTO product_images (id, product_id, url, sort_order, is_primary) VALUES (?, ?, ?, 0, 1)"
        )
        .bind(crypto.randomUUID(), productId, options.imageUrl)
    );
  }

  await db.batch(statements);
  return productId;
}

/** Partial update. Price changes also append a price_history row. */
export async function updateProduct(productId: string, patch: Partial<ProductInput>): Promise<void> {
  const db = await getDB();

  const columns: Record<string, unknown> = {
    name: patch.name,
    slug: patch.slug,
    sku: patch.sku,
    description: patch.description,
    hero_headline: patch.heroHeadline,
    hero_subtitle: patch.heroSubtitle,
    category_id: patch.categoryId,
    brand_id: patch.brandId,
    status: patch.status,
    price: patch.price,
    old_price: patch.oldPrice,
    is_featured: patch.isFeatured === undefined ? undefined : patch.isFeatured ? 1 : 0,
    is_best_seller: patch.isBestSeller === undefined ? undefined : patch.isBestSeller ? 1 : 0,
  };

  const entries = Object.entries(columns).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
  const binds = entries.map(([, value]) => value);

  const statements = [
    db
      .prepare(`UPDATE products SET ${assignments}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...binds, productId),
  ];

  if (typeof patch.price === "number") {
    statements.push(
      db
        .prepare("INSERT INTO price_history (id, product_id, price, old_price) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), productId, patch.price, patch.oldPrice ?? 0)
    );
  }

  await db.batch(statements);
}

export async function setProductStatus(
  productId: string,
  status: ProductStatus,
  rejectionReason?: string
): Promise<void> {
  const db = await getDB();
  await db
    .prepare(
      "UPDATE products SET status = ?, rejection_reason = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(status, rejectionReason ?? null, productId)
    .run();
}

export async function addProductImage(
  productId: string,
  url: string,
  options: { isPrimary?: boolean; sortOrder?: number } = {}
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO product_images (id, product_id, url, sort_order, is_primary) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(id, productId, url, options.sortOrder ?? 0, options.isPrimary ? 1 : 0)
    .run();
  return id;
}

export interface VariantInput {
  optionName?: string | null;
  optionValue?: string | null;
  option2Name?: string | null;
  option2Value?: string | null;
  swatch?: string | null;
  sku?: string | null;
  price?: number | null;
  oldPrice?: number | null;
  stockQuantity?: number;
  imageUrl?: string | null;
}

export async function addVariant(productId: string, input: VariantInput): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, option1_name, option1_value,
                                     option2_name, option2_value, swatch, price, old_price,
                                     stock_quantity, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      productId,
      input.sku ?? null,
      input.optionName ?? null,
      input.optionValue ?? null,
      input.option2Name ?? null,
      input.option2Value ?? null,
      input.swatch ?? null,
      input.price ?? null,
      input.oldPrice ?? null,
      input.stockQuantity ?? 0,
      input.imageUrl ?? null
    )
    .run();
  return id;
}

/** Soft delete: archiving keeps order history and reviews intact, which a
 * hard DELETE would cascade away. */
export async function archiveProduct(productId: string): Promise<void> {
  await setProductStatus(productId, "archived");
}
