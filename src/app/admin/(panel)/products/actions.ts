"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { invalidateCatalog } from "@/lib/cache";
import { AuthorizationError, logAdminAction, requireAdmin } from "@/lib/admin";
import { setProductStatus } from "@/lib/catalog";
import { adminUrl } from "@/lib/adminUrl";
import { adjustStock } from "@/lib/inventory";
import {
  OptionValidationError,
  parseOptionsPayload,
  planOptionWrite,
} from "@/lib/productOptions";
import type { ProductStatus } from "@/types";

export interface ProductFormState {
  error?: string;
  success?: string;
  /** The product's new `updated_at`, handed back so the open form can save
   * again without being told it is out of date by its own previous save. */
  savedAt?: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "product"
  );
}

/** Slugs are unique in the schema, so a second "Cotton T-Shirt" needs a
 * suffix rather than a failed insert. `exceptId` lets an edit keep its own
 * slug instead of bumping it to -2 on every save. */
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const db = await getDB();
  let candidate = base;

  for (let attempt = 2; attempt < 60; attempt += 1) {
    const clash = await db
      .prepare("SELECT id FROM products WHERE slug = ? AND id != ?")
      .bind(candidate, exceptId ?? "")
      .first<{ id: string }>();
    if (!clash) return candidate;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function readInt(formData: FormData, key: string, fallback = 0): number {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

/** Turns the form's price + discount pair into the two columns the catalog
 * stores. `price` is always what the shopper pays; `old_price` is the struck
 * through original, and is 0 when there is no discount so `discountPercent()`
 * reports none. */
function resolvePricing(formData: FormData): { price: number; oldPrice: number } | string {
  const base = readInt(formData, "price");
  if (base <= 0) return "Enter a price greater than zero.";

  const type = String(formData.get("discountType") ?? "none");
  const value = readInt(formData, "discountValue");

  if (type === "none" || value <= 0) return { price: base, oldPrice: 0 };

  if (type === "percent") {
    if (value >= 100) return "A percentage discount must be under 100.";
    return { price: Math.max(1, Math.round(base * (1 - value / 100))), oldPrice: base };
  }

  if (value >= base) return "The discount cannot be larger than the price.";
  return { price: base - value, oldPrice: base };
}

/** Splits a comma-separated field into trimmed, de-duplicated values. */
function readList(formData: FormData, key: string): string[] {
  return [
    ...new Set(
      String(formData.get(key) ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    ),
  ];
}

/** Errors become a message on the form rather than a crash screen.
 *
 * A save is a single transaction, so whatever went wrong, nothing was written:
 * that is worth telling the admin plainly rather than showing them a stack.
 * `redirect()` throws a control-flow error of its own and has to pass through
 * untouched. Anything unexpected is still logged, because a friendly message
 * on the screen is not a reason to lose the reason from the server log. */
function toFormError(error: unknown): ProductFormState {
  if (error instanceof AuthorizationError) return { error: error.message };
  // Something the admin can fix -- a duplicate SKU, too many combinations.
  if (error instanceof OptionValidationError) return { error: error.message };

  // What Next throws to redirect or to render notFound(); not ours to swallow.
  const digest = (error as { digest?: string } | null)?.digest;
  if (typeof digest === "string" && digest.startsWith("NEXT_")) throw error;

  console.error("Product save failed:", error);
  return {
    error:
      "That could not be saved and nothing was changed — the whole save is applied together or not at all. Check the values and try again.",
  };
}

function refreshProductViews(productId?: string): void {
  revalidatePath("/admin/products");
  if (productId) revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin");
  revalidatePath("/");
}

/* -------------------------------------------------------------------------- */
/* Create & update                                                            */
/* -------------------------------------------------------------------------- */

/** `products.sku` is globally unique, the same as a variant's.
 *
 * Without this the constraint surfaces as a raw D1 error in the middle of the
 * batch, which reaches the admin as a crash screen rather than as "that code is
 * already in use". */
async function assertProductSkuIsFree(sku: string | null, productId: string | null): Promise<void> {
  if (!sku) return;
  const db = await getDB();
  const owner = await db
    .prepare("SELECT id FROM products WHERE sku = ?")
    .bind(sku)
    .first<{ id: string }>();

  if (owner && owner.id !== productId) {
    throw new OptionValidationError(`The product code "${sku}" is already used by another product.`);
  }
}

/** The product's gallery after a save, as url -> image id.
 *
 * A variant points at a `product_images` row, so the id has to survive a save
 * or every picture assignment would be lost the moment anything else on the
 * product changed. Images are therefore diffed by URL rather than replaced: a
 * row whose URL is still in the list keeps its id, one that has gone is
 * deleted, and only a genuinely new URL gets a new row. Because the new ids are
 * generated here, the map is complete before the batch has even run. */
function planImages(
  db: D1Database,
  productId: string,
  postedUrls: string[],
  existing: { id: string; url: string }[]
): { statements: D1PreparedStatement[]; imageIdByUrl: Map<string, string> } {
  const urls = [...new Set(postedUrls)];
  const idByUrl = new Map(existing.map((image) => [image.url, image.id]));
  const statements: D1PreparedStatement[] = [];
  const imageIdByUrl = new Map<string, string>();

  for (const image of existing) {
    if (!urls.includes(image.url)) {
      // The variants pointing at it have their image_id set to NULL by the
      // foreign key, which is the right answer: the picture is gone.
      statements.push(db.prepare("DELETE FROM product_images WHERE id = ?").bind(image.id));
    }
  }

  urls.forEach((url, index) => {
    const existingId = idByUrl.get(url);
    const id = existingId ?? crypto.randomUUID();
    imageIdByUrl.set(url, id);

    statements.push(
      existingId
        ? db
            .prepare("UPDATE product_images SET sort_order = ?, is_primary = ? WHERE id = ?")
            .bind(index, index === 0 ? 1 : 0, id)
        : db
            .prepare(
              `INSERT INTO product_images (id, product_id, url, sort_order, is_primary)
               VALUES (?, ?, ?, ?, ?)`
            )
            .bind(id, productId, url, index, index === 0 ? 1 : 0)
    );
  });

  return { statements, imageIdByUrl };
}

/** Reads the video list the form posts back.
 *
 * VideoUploader posts two positionally aligned lists -- one URL per clip and
 * one poster per clip, the poster empty when the browser could not grab a
 * still -- so they are zipped here rather than parsed out of one encoded
 * field. Only the clip URL is required; a missing poster is normal. */
function readVideos(formData: FormData): { url: string; poster: string | null }[] {
  const urls = formData.getAll("videos").map(String);
  const posters = formData.getAll("videoPosters").map(String);

  return urls
    .map((url, index) => ({ url: url.trim(), poster: (posters[index] ?? "").trim() || null }))
    .filter((video) => video.url.length > 0);
}

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  let productId: string;
  let optionWrite: Awaited<ReturnType<typeof planOptionWrite>> | null = null;

  try {
    const admin = await requireAdmin();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Enter a product name." };

    const pricing = resolvePricing(formData);
    if (typeof pricing === "string") return { error: pricing };

    const db = await getDB();
    productId = crypto.randomUUID();
    const slug = await uniqueSlug(slugify(name));
    const sku = readText(formData, "sku");
    await assertProductSkuIsFree(sku, null);
    const status = (String(formData.get("status") ?? "draft") as ProductStatus) ?? "draft";

    const tags = readList(formData, "tags");
    const images = formData.getAll("images").map(String).filter(Boolean);
    const videos = readVideos(formData);
    const options = parseOptionsPayload(formData.get("options"));

    const length = readInt(formData, "length");
    const width = readInt(formData, "width");
    const height = readInt(formData, "height");
    const dimensions = length || width || height ? JSON.stringify({ l: length, w: width, h: height }) : null;

    // Weight is entered in kilograms and stored in grams, so a 0.25 kg entry
    // survives as an integer rather than rounding to zero.
    const weightKg = Number(String(formData.get("weight") ?? "").trim());
    const weightGrams = Number.isFinite(weightKg) && weightKg > 0 ? Math.round(weightKg * 1000) : null;

    const statements = [
      db
        .prepare(
          `INSERT INTO products (id, seller_id, category_id, brand_id, name, slug, sku, description,
                                 status, price, old_price, is_featured, is_best_seller,
                                 weight_grams, dimensions_json, meta_title, meta_description)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          productId,
          readText(formData, "categoryId"),
          readText(formData, "brandId"),
          name,
          slug,
          sku,
          readText(formData, "description"),
          status,
          pricing.price,
          pricing.oldPrice,
          formData.get("isFeatured") ? 1 : 0,
          formData.get("isBestSeller") ? 1 : 0,
          weightGrams,
          dimensions,
          readText(formData, "metaTitle"),
          readText(formData, "metaDescription")
        ),
      db
        .prepare("INSERT INTO price_history (id, product_id, price, old_price) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), productId, pricing.price, pricing.oldPrice),
    ];

    const gallery = planImages(db, productId, images, []);
    statements.push(...gallery.statements);

    // Options, values, combinations and the legacy colour/size mirror, all
    // through the one module that writes them -- and in this same batch, so a
    // product either arrives complete or not at all.
    optionWrite = await planOptionWrite({
      productId,
      input: options,
      imageIdByUrl: gallery.imageIdByUrl,
      isNewProduct: true,
      userId: admin.id,
      note: "Opening stock from the product form",
    });
    statements.push(...optionWrite.statements);

    videos.forEach((video, index) => {
      statements.push(
        db
          .prepare(
            `INSERT INTO product_videos (id, product_id, url, poster_url, sort_order)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(crypto.randomUUID(), productId, video.url, video.poster, index)
      );
    });

    tags.forEach((tag, index) => {
      statements.push(
        db
          .prepare(
            `INSERT INTO product_attributes (id, product_id, attr_name, attr_value, sort_order)
             VALUES (?, ?, 'tag', ?, ?)`
          )
          .bind(crypto.randomUUID(), productId, tag, index)
      );
    });

    await db.batch(statements);
    await logAdminAction(admin.id, "product.create", "product", productId, {
      after: { name, price: pricing.price, status, combinations: optionWrite.plan.variants.length },
    });
    await invalidateCatalog();
  } catch (error) {
    return toFormError(error);
  }

  refreshProductViews(productId);
  redirect(await adminUrl(`/admin/products/${productId}`) + "?saved=1");
}

export async function updateProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { error: "Missing product." };

  let optionWrite: Awaited<ReturnType<typeof planOptionWrite>> | null = null;
  let savedAt: string | null = null;

  try {
    const admin = await requireAdmin();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Enter a product name." };

    const pricing = resolvePricing(formData);
    if (typeof pricing === "string") return { error: pricing };

    const db = await getDB();
    const before = await db
      .prepare("SELECT name, price, old_price, status, slug FROM products WHERE id = ?")
      .bind(productId)
      .first<{ name: string; price: number; old_price: number; status: string; slug: string }>();

    if (!before) return { error: "That product no longer exists." };

    // Two admins on the same product would otherwise each overwrite the
    // other's options with their own idea of them. Claiming the row with a
    // conditional UPDATE is the same trick the order code uses for stock: it
    // is atomic, so exactly one of two simultaneous saves can win, and the
    // loser is told rather than silently discarded. The claim moves
    // `updated_at`, which is what the condition tests, so the second save sees
    // no rows matched.
    const expectedUpdatedAt = readText(formData, "updatedAt");
    const claim = await db
      .prepare("UPDATE products SET updated_at = datetime('now') WHERE id = ? AND updated_at IS ?")
      .bind(productId, expectedUpdatedAt)
      .run();

    if (claim.meta.changes !== 1) {
      return {
        error:
          "Someone else saved this product while you were editing it. Reload the page so you are working from their version, then make your change again.",
      };
    }

    // Renaming re-slugs, but an unchanged name keeps the URL it already has so
    // existing links and shares don't break on an unrelated edit.
    const slug =
      before.name === name ? before.slug : await uniqueSlug(slugify(name), productId);

    const status = String(formData.get("status") ?? before.status) as ProductStatus;
    await assertProductSkuIsFree(readText(formData, "sku"), productId);
    const tags = readList(formData, "tags");
    const images = formData.getAll("images").map(String).filter(Boolean);
    const videos = readVideos(formData);
    const options = parseOptionsPayload(formData.get("options"));

    const currentImages = await db
      .prepare("SELECT id, url FROM product_images WHERE product_id = ?")
      .bind(productId)
      .all<{ id: string; url: string }>();

    const length = readInt(formData, "length");
    const width = readInt(formData, "width");
    const height = readInt(formData, "height");
    const dimensions = length || width || height ? JSON.stringify({ l: length, w: width, h: height }) : null;

    const weightKg = Number(String(formData.get("weight") ?? "").trim());
    const weightGrams = Number.isFinite(weightKg) && weightKg > 0 ? Math.round(weightKg * 1000) : null;

    const statements = [
      db
        .prepare(
          `UPDATE products SET name = ?, slug = ?, sku = ?, description = ?, category_id = ?,
                               brand_id = ?, status = ?, price = ?, old_price = ?,
                               is_featured = ?, is_best_seller = ?, weight_grams = ?,
                               dimensions_json = ?, meta_title = ?, meta_description = ?,
                               updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          name,
          slug,
          readText(formData, "sku"),
          readText(formData, "description"),
          readText(formData, "categoryId"),
          readText(formData, "brandId"),
          status,
          pricing.price,
          pricing.oldPrice,
          formData.get("isFeatured") ? 1 : 0,
          formData.get("isBestSeller") ? 1 : 0,
          weightGrams,
          dimensions,
          readText(formData, "metaTitle"),
          readText(formData, "metaDescription"),
          productId
        ),
      // Videos and tags are replace-all: the form always posts the complete
      // list and nothing references either row, so diffing them would be more
      // code for the same result. Images are the exception -- a variant points
      // at one -- and are diffed by URL below.
      db.prepare("DELETE FROM product_videos WHERE product_id = ?").bind(productId),
      db
        .prepare("DELETE FROM product_attributes WHERE product_id = ? AND attr_name = 'tag'")
        .bind(productId),
    ];

    const gallery = planImages(db, productId, images, currentImages.results ?? []);
    statements.push(...gallery.statements);

    optionWrite = await planOptionWrite({
      productId,
      input: options,
      imageIdByUrl: gallery.imageIdByUrl,
      isNewProduct: false,
      userId: admin.id,
      note: "Set from the product options editor",
    });
    statements.push(...optionWrite.statements);

    videos.forEach((video, index) => {
      statements.push(
        db
          .prepare(
            `INSERT INTO product_videos (id, product_id, url, poster_url, sort_order)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(crypto.randomUUID(), productId, video.url, video.poster, index)
      );
    });

    tags.forEach((tag, index) => {
      statements.push(
        db
          .prepare(
            `INSERT INTO product_attributes (id, product_id, attr_name, attr_value, sort_order)
             VALUES (?, ?, 'tag', ?, ?)`
          )
          .bind(crypto.randomUUID(), productId, tag, index)
      );
    });

    if (before.price !== pricing.price || before.old_price !== pricing.oldPrice) {
      statements.push(
        db
          .prepare(
            `INSERT INTO price_history (id, product_id, price, old_price, changed_by)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(crypto.randomUUID(), productId, pricing.price, pricing.oldPrice, admin.id)
      );
    }

    await db.batch(statements);
    savedAt =
      (
        await db
          .prepare("SELECT updated_at FROM products WHERE id = ?")
          .bind(productId)
          .first<{ updated_at: string | null }>()
      )?.updated_at ?? null;
    await logAdminAction(admin.id, "product.update", "product", productId, {
      before,
      after: {
        name,
        price: pricing.price,
        status,
        combinations: optionWrite.plan.variants.length,
        retired: optionWrite.plan.retireVariantIds.length,
      },
    });
    await invalidateCatalog();
  } catch (error) {
    // The claim above moved `updated_at` before the batch ran. The batch then
    // rolled back, but the claim did not, so the form is holding a version that
    // no longer matches. Handing back the current one keeps a retry from being
    // mistaken for someone else's edit.
    const current = await (await getDB())
      .prepare("SELECT updated_at FROM products WHERE id = ?")
      .bind(productId)
      .first<{ updated_at: string | null }>();
    return { ...toFormError(error), savedAt: current?.updated_at ?? undefined };
  }

  refreshProductViews(productId);

  return {
    savedAt: savedAt ?? undefined,
    success:
      optionWrite.stockMoves > 0
        ? `Product saved. Stock updated for ${optionWrite.stockMoves} combination${
            optionWrite.stockMoves === 1 ? "" : "s"
          }.`
        : "Product saved.",
  };
}

/* -------------------------------------------------------------------------- */
/* Variants & stock                                                           */
/* -------------------------------------------------------------------------- */

/** Sets a variant's stock to an absolute figure, writing the difference to the
 * ledger so `inventory_movements` still reconciles with the cached quantity. */
export async function setVariantStockAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const variantId = String(formData.get("variantId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const quantity = Math.max(0, readInt(formData, "quantity"));
  if (!variantId) return;

  const db = await getDB();
  const current = await db
    .prepare("SELECT stock_quantity FROM product_variants WHERE id = ?")
    .bind(variantId)
    .first<{ stock_quantity: number }>();

  if (!current) return;

  const delta = quantity - current.stock_quantity;
  if (delta !== 0) {
    await adjustStock(variantId, delta, delta > 0 ? "restock" : "adjustment", {
      referenceType: "manual",
      note: "Set from the admin panel",
      userId: admin.id,
    });
    await logAdminAction(admin.id, "inventory.set", "variant", variantId, {
      before: { stock: current.stock_quantity },
      after: { stock: quantity },
    });
  }

  await invalidateCatalog();
  refreshProductViews(productId);
}

export async function addVariantAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return;

  const color = readText(formData, "color");
  const size = readText(formData, "size");
  if (!color && !size) return;

  const db = await getDB();
  const variantId = crypto.randomUUID();
  const priceRaw = readInt(formData, "variantPrice");

  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, option1_name, option1_value,
                                     option2_name, option2_value, swatch, price,
                                     stock_quantity, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      variantId,
      productId,
      color ? "Color" : null,
      color,
      size ? "Size" : null,
      size,
      readText(formData, "swatch"),
      // NULL means "inherit the product price", which is what an empty field
      // should mean rather than a price of zero.
      priceRaw > 0 ? priceRaw : null,
      Math.max(0, readInt(formData, "variantStock")),
      Math.max(0, readInt(formData, "variantThreshold", 5))
    )
    .run();

  await logAdminAction(admin.id, "variant.create", "variant", variantId, {
    after: { productId, color, size },
  });
  await invalidateCatalog();
  refreshProductViews(productId);
}

export async function deleteVariantAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const variantId = String(formData.get("variantId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!variantId) return;

  const db = await getDB();
  // The last variant is what carries the product's stock, so removing it would
  // leave a product that can never be sold. Deactivating is the safe path.
  const remaining = await db
    .prepare("SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ? AND is_active = 1")
    .bind(productId)
    .first<{ n: number }>();

  if ((remaining?.n ?? 0) <= 1) return;

  await db
    .prepare("UPDATE product_variants SET is_active = 0 WHERE id = ?")
    .bind(variantId)
    .run();

  await logAdminAction(admin.id, "variant.delete", "variant", variantId);
  await invalidateCatalog();
  refreshProductViews(productId);
}

/* -------------------------------------------------------------------------- */
/* Status & bulk actions                                                      */
/* -------------------------------------------------------------------------- */

const ALLOWED_STATUSES: ProductStatus[] = [
  "draft",
  "pending_review",
  "active",
  "rejected",
  "archived",
];

export async function setProductStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const status = String(formData.get("status") ?? "") as ProductStatus;

  if (!productId || !ALLOWED_STATUSES.includes(status)) return;

  await setProductStatus(productId, status);
  await logAdminAction(admin.id, `product.${status}`, "product", productId, {
    after: { status },
  });
  await invalidateCatalog();
  refreshProductViews(productId);
}

/** Archive rather than DELETE: a hard delete cascades away the order lines and
 * reviews that reference the product, rewriting sales history. */
export async function archiveProductAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return;

  await setProductStatus(productId, "archived");
  await logAdminAction(admin.id, "product.archive", "product", productId);
  await invalidateCatalog();
  refreshProductViews(productId);
}

export async function bulkProductAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const ids = formData.getAll("selected").map(String).filter(Boolean);
  const action = String(formData.get("bulkAction") ?? "");

  if (ids.length === 0) return;

  const status: ProductStatus | null =
    action === "publish"
      ? "active"
      : action === "draft"
        ? "draft"
        : action === "archive"
          ? "archived"
          : null;

  if (!status) return;

  const db = await getDB();
  const placeholders = ids.map(() => "?").join(",");
  await db
    .prepare(
      `UPDATE products SET status = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
    )
    .bind(status, ...ids)
    .run();

  await logAdminAction(admin.id, `product.bulk.${action}`, "product", null, {
    after: { ids, status },
  });
  await invalidateCatalog();
  refreshProductViews();
}

/* -------------------------------------------------------------------------- */
/* Brands                                                                     */
/* -------------------------------------------------------------------------- */

/** Brands are a flat lookup with no screen of their own, so they are created
 * inline from the product form rather than needing a separate page first. */
export async function createBrandAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const name = String(formData.get("brandName") ?? "").trim();
  if (!name) return;

  const db = await getDB();
  const existing = await db
    .prepare("SELECT id FROM brands WHERE name = ? COLLATE NOCASE")
    .bind(name)
    .first<{ id: string }>();
  if (existing) return;

  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO brands (id, name, slug) VALUES (?, ?, ?)")
    .bind(id, name, await uniqueBrandSlug(slugify(name)))
    .run();

  await logAdminAction(admin.id, "brand.create", "brand", id, { after: { name } });
  await invalidateCatalog();
  revalidatePath("/admin/products/new");
}

async function uniqueBrandSlug(base: string): Promise<string> {
  const db = await getDB();
  let candidate = base;

  for (let attempt = 2; attempt < 60; attempt += 1) {
    const clash = await db
      .prepare("SELECT id FROM brands WHERE slug = ?")
      .bind(candidate)
      .first<{ id: string }>();
    if (!clash) return candidate;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}
