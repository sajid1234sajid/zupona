/** Writing a product from the product form, for both back offices.
 *
 * The admin panel and the Seller Center post the same form, and a product has
 * one correct shape whoever saves it: gallery diffed by URL, options and
 * stock through `planOptionWrite`, price history on every price change, the
 * whole save in one batch. Keeping a second copy of this for sellers would
 * have meant two places to get the stock ledger right, so both panels' server
 * actions are thin wrappers around the two functions here and differ only in
 * the `SaveContext` they pass:
 *
 *  - who owns the product (the platform, or one seller's store),
 *  - which statuses that owner may choose -- a seller cannot publish past
 *    review when the shop requires it, nor mark their own product rejected,
 *  - and whether homepage merchandising (featured, best seller) is theirs to
 *    set. It is the platform's shop window, so for a seller those flags are
 *    left exactly as the admin set them.
 *
 * Authorization is the caller's job: the wrapper runs `requireAdmin()` or
 * `requireApprovedSeller()` and hands the result in here. What this module
 * does enforce is ownership on update, because that is a property of the row
 * being written and cannot be checked before it is read. */

import { getDB } from "@/lib/db";
import { invalidateCatalog } from "@/lib/cache";
import { AuthorizationError, logAdminAction } from "@/lib/admin";
import { OptionValidationError, parseOptionsPayload, planOptionWrite } from "@/lib/productOptions";
import type { OptionsInput } from "@/lib/optionModel";
import {
  applyDiscount,
  hasDiscount,
  NO_DISCOUNT,
  type DiscountRule,
  type DiscountType,
} from "@/lib/productDiscount";
import type { ProductStatus } from "@/types";

export interface ProductFormState {
  error?: string;
  success?: string;
  /** The product's new `updated_at`, handed back so the open form can save
   * again without being told it is out of date by its own previous save. */
  savedAt?: string;
}

export type ProductOwner =
  | { kind: "platform" }
  | {
      kind: "seller";
      sellerId: string;
      /** Whether this shop holds seller products for an admin's approval
       * before they go live (`site_settings.seller_products_need_review`). */
      needsReview: boolean;
    };

export interface SaveContext {
  /** The signed-in user doing the save, for the ledger and the audit trail. */
  actorId: string;
  owner: ProductOwner;
}

/* -------------------------------------------------------------------------- */
/* Form readers                                                               */
/* -------------------------------------------------------------------------- */

export function slugify(value: string): string {
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

export function readInt(formData: FormData, key: string, fallback = 0): number {
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
function resolvePricing(
  formData: FormData
): { price: number; oldPrice: number; discount: DiscountRule } | string {
  const base = readInt(formData, "price");
  if (base <= 0) return "Enter a price greater than zero.";

  const rawType = String(formData.get("discountType") ?? "none");
  const type: DiscountType = rawType === "percent" || rawType === "fixed" ? rawType : "none";
  const discount: DiscountRule = { type, value: readInt(formData, "discountValue") };

  if (!hasDiscount(discount)) return { price: base, oldPrice: 0, discount: NO_DISCOUNT };
  if (type === "percent" && discount.value >= 100) return "A percentage discount must be under 100.";
  if (type === "fixed" && discount.value >= base) return "The discount cannot be larger than the price.";

  return { price: applyDiscount(base, discount), oldPrice: base, discount };
}

/** Carries the product's discount onto combinations that have their own price.
 *
 * A combination's price replaces the product's outright, so without this a
 * discount set on the product never reached a size or colour priced on its
 * own: the page sold it at full price with nothing struck through, while the
 * card on the shelf advertised the discount. The typed figure is read as the
 * pre-discount price, the same as the product's own Price box. A combination
 * given its own compare-at price is left as typed -- that is its own deal. */
function applyDiscountToVariants(options: OptionsInput, discount: DiscountRule): OptionsInput {
  if (!hasDiscount(discount)) return options;

  return {
    ...options,
    variants: options.variants.map((variant) => {
      if (variant.price === null || variant.price <= 0) return variant;
      if (variant.oldPrice !== null && variant.oldPrice > 0) return variant;

      if (discount.type === "fixed" && discount.value >= variant.price) {
        throw new OptionValidationError(
          `The ৳${discount.value} discount is larger than a combination priced at ৳${variant.price}.`
        );
      }
      return { ...variant, price: applyDiscount(variant.price, discount), oldPrice: variant.price };
    }),
  };
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

/** Whether the product's stock is limited.
 *
 * The form posts "1" or "0" outright, so both answers arrive as a value rather
 * than one of them being the absence of a field. The marker beside it still
 * matters: a form that did not carry the choice at all returns null and leaves
 * the stored setting alone, instead of silently reading as unlimited. */
function readTrackInventory(formData: FormData): boolean | null {
  if (formData.get("__present_trackInventory") === null) return null;
  return String(formData.get("trackInventory") ?? "") === "1";
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

function readShipping(formData: FormData): { dimensions: string | null; weightGrams: number | null } {
  const length = readInt(formData, "length");
  const width = readInt(formData, "width");
  const height = readInt(formData, "height");
  const dimensions =
    length || width || height ? JSON.stringify({ l: length, w: width, h: height }) : null;

  // Weight is entered in kilograms and stored in grams, so a 0.25 kg entry
  // survives as an integer rather than rounding to zero.
  const weightKg = Number(String(formData.get("weight") ?? "").trim());
  const weightGrams = Number.isFinite(weightKg) && weightKg > 0 ? Math.round(weightKg * 1000) : null;

  return { dimensions, weightGrams };
}

/* -------------------------------------------------------------------------- */
/* Status policy                                                              */
/* -------------------------------------------------------------------------- */

const ADMIN_STATUSES: ProductStatus[] = ["draft", "pending_review", "active", "rejected", "archived"];

/** The statuses an owner may pick on the form for a product currently in
 * `current` (null on create).
 *
 * A seller under review can submit, park as a draft or archive, but not
 * publish: going live is the admin's decision. A product that is already live
 * keeps "active" on offer, so editing a typo in an approved listing does not
 * pull it off the shelf. `rejected` is never the seller's to choose. */
export function statusesFor(owner: ProductOwner, current: string | null): ProductStatus[] {
  if (owner.kind === "platform") return ADMIN_STATUSES;
  if (!owner.needsReview) return ["active", "draft", "archived"];
  return current === "active"
    ? ["active", "pending_review", "draft", "archived"]
    : ["pending_review", "draft", "archived"];
}

function resolveStatus(
  posted: FormDataEntryValue | null,
  current: string | null,
  owner: ProductOwner
): ProductStatus {
  const allowed = statusesFor(owner, current);
  const wanted = String(posted ?? "") as ProductStatus;
  if (allowed.includes(wanted)) return wanted;

  // Nothing usable was posted. An edit keeps what the product already has --
  // a rejected product saved with no radio ticked stays rejected rather than
  // quietly resubmitting itself.
  if (current) return current as ProductStatus;
  if (owner.kind === "platform") return "draft";
  return owner.needsReview ? "pending_review" : "active";
}

/* -------------------------------------------------------------------------- */
/* Shared pieces of a save                                                    */
/* -------------------------------------------------------------------------- */

/** Errors become a message on the form rather than a crash screen.
 *
 * A save is a single transaction, so whatever went wrong, nothing was written:
 * that is worth saying plainly rather than showing a stack. `redirect()`
 * throws a control-flow error of its own and has to pass through untouched.
 * Anything unexpected is still logged, because a friendly message on the
 * screen is not a reason to lose the reason from the server log. */
export function toFormError(error: unknown): ProductFormState {
  if (error instanceof AuthorizationError) return { error: error.message };
  // Something the person can fix -- a duplicate SKU, too many combinations.
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

/** `products.sku` is globally unique, the same as a variant's.
 *
 * Without this the constraint surfaces as a raw D1 error in the middle of the
 * batch, which reaches the person as a crash screen rather than as "that code
 * is already in use". */
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

/** Videos and tags are replace-all: the form always posts the complete list
 * and nothing references either row, so diffing them would be more code for
 * the same result. Images are the exception -- a variant points at one -- and
 * are diffed by URL in `planImages`. */
function mediaAndTagStatements(
  db: D1Database,
  productId: string,
  videos: { url: string; poster: string | null }[],
  tags: string[]
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];

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

  return statements;
}

function auditAction(owner: ProductOwner, verb: string): string {
  return owner.kind === "seller" ? `seller.product.${verb}` : `product.${verb}`;
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

/** Creates a product from the form. Resolves with the new id, or with the
 * message to show on the form when nothing was written. */
export async function createProductFromForm(
  formData: FormData,
  context: SaveContext
): Promise<{ productId: string } | { error: string }> {
  try {
    const { owner } = context;

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Enter a product name." };

    const pricing = resolvePricing(formData);
    if (typeof pricing === "string") return { error: pricing };

    const db = await getDB();
    const productId = crypto.randomUUID();
    const slug = await uniqueSlug(slugify(name));
    const sku = readText(formData, "sku");
    await assertProductSkuIsFree(sku, null);
    const status = resolveStatus(formData.get("status"), null, owner);
    const sellerId = owner.kind === "seller" ? owner.sellerId : null;
    const merchandising = owner.kind === "platform";

    const tags = readList(formData, "tags");
    const images = formData.getAll("images").map(String).filter(Boolean);
    const videos = readVideos(formData);
    const options = applyDiscountToVariants(
      parseOptionsPayload(formData.get("options")),
      pricing.discount
    );
    const { dimensions, weightGrams } = readShipping(formData);

    const statements = [
      db
        .prepare(
          `INSERT INTO products (id, seller_id, category_id, brand_id, name, slug, sku, description,
                                 status, price, old_price, is_featured, is_best_seller,
                                 track_inventory, free_delivery, weight_grams, dimensions_json,
                                 meta_title, meta_description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          productId,
          sellerId,
          readText(formData, "categoryId"),
          readText(formData, "brandId"),
          name,
          slug,
          sku,
          readText(formData, "description"),
          status,
          pricing.price,
          pricing.oldPrice,
          merchandising && formData.get("isFeatured") ? 1 : 0,
          merchandising && formData.get("isBestSeller") ? 1 : 0,
          readTrackInventory(formData) ? 1 : 0,
          formData.get("freeDelivery") ? 1 : 0,
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
    const optionWrite = await planOptionWrite({
      productId,
      input: options,
      imageIdByUrl: gallery.imageIdByUrl,
      isNewProduct: true,
      userId: context.actorId,
      note: "Opening stock from the product form",
    });
    statements.push(...optionWrite.statements);
    statements.push(...mediaAndTagStatements(db, productId, videos, tags));

    await db.batch(statements);
    await logAdminAction(context.actorId, auditAction(owner, "create"), "product", productId, {
      after: {
        name,
        price: pricing.price,
        status,
        sellerId,
        combinations: optionWrite.plan.variants.length,
      },
    });
    await invalidateCatalog();

    return { productId };
  } catch (error) {
    const state = toFormError(error);
    return { error: state.error ?? "That could not be saved." };
  }
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateProductFromForm(
  formData: FormData,
  context: SaveContext
): Promise<ProductFormState> {
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { error: "Missing product." };

  const { owner } = context;
  let savedAt: string | null = null;
  let stockMoves = 0;

  try {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Enter a product name." };

    const pricing = resolvePricing(formData);
    if (typeof pricing === "string") return { error: pricing };

    const db = await getDB();
    const before = await db
      .prepare("SELECT name, price, old_price, status, slug, seller_id FROM products WHERE id = ?")
      .bind(productId)
      .first<{
        name: string;
        price: number;
        old_price: number;
        status: string;
        slug: string;
        seller_id: string | null;
      }>();

    if (!before) return { error: "That product no longer exists." };

    // A seller can only ever write to their own store's products. The id came
    // from the browser, so this is the check that stops one shop editing
    // another's listing by changing a hidden field.
    if (owner.kind === "seller" && before.seller_id !== owner.sellerId) {
      return { error: "That product isn't yours to manage." };
    }

    // Two people on the same product would otherwise each overwrite the
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

    const status = resolveStatus(formData.get("status"), before.status, owner);
    await assertProductSkuIsFree(readText(formData, "sku"), productId);
    const tags = readList(formData, "tags");
    const images = formData.getAll("images").map(String).filter(Boolean);
    const videos = readVideos(formData);
    const options = applyDiscountToVariants(
      parseOptionsPayload(formData.get("options")),
      pricing.discount
    );

    const currentImages = await db
      .prepare("SELECT id, url FROM product_images WHERE product_id = ?")
      .bind(productId)
      .all<{ id: string; url: string }>();

    const { dimensions, weightGrams } = readShipping(formData);
    const trackInventory = readTrackInventory(formData);

    // NULL leaves the stored flag alone, which is what a seller's save means
    // for the platform's merchandising.
    const merchandising = owner.kind === "platform";
    const featured = merchandising ? (formData.get("isFeatured") ? 1 : 0) : null;
    const bestSeller = merchandising ? (formData.get("isBestSeller") ? 1 : 0) : null;

    const statements = [
      db
        .prepare(
          `UPDATE products SET name = ?, slug = ?, sku = ?, description = ?, category_id = ?,
                               brand_id = ?, status = ?, price = ?, old_price = ?,
                               is_featured = COALESCE(?, is_featured),
                               is_best_seller = COALESCE(?, is_best_seller),
                               track_inventory = COALESCE(?, track_inventory),
                               free_delivery = ?, weight_grams = ?,
                               dimensions_json = ?, meta_title = ?, meta_description = ?,
                               rejection_reason = CASE WHEN ? = 'rejected' THEN rejection_reason ELSE NULL END,
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
          featured,
          bestSeller,
          trackInventory === null ? null : trackInventory ? 1 : 0,
          formData.get("freeDelivery") ? 1 : 0,
          weightGrams,
          dimensions,
          readText(formData, "metaTitle"),
          readText(formData, "metaDescription"),
          status,
          productId
        ),
      db.prepare("DELETE FROM product_videos WHERE product_id = ?").bind(productId),
      db
        .prepare("DELETE FROM product_attributes WHERE product_id = ? AND attr_name = 'tag'")
        .bind(productId),
    ];

    const gallery = planImages(db, productId, images, currentImages.results ?? []);
    statements.push(...gallery.statements);

    const optionWrite = await planOptionWrite({
      productId,
      input: options,
      imageIdByUrl: gallery.imageIdByUrl,
      isNewProduct: false,
      userId: context.actorId,
      note: "Set from the product options editor",
    });
    statements.push(...optionWrite.statements);
    statements.push(...mediaAndTagStatements(db, productId, videos, tags));

    if (before.price !== pricing.price || before.old_price !== pricing.oldPrice) {
      statements.push(
        db
          .prepare(
            `INSERT INTO price_history (id, product_id, price, old_price, changed_by)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(crypto.randomUUID(), productId, pricing.price, pricing.oldPrice, context.actorId)
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
    await logAdminAction(context.actorId, auditAction(owner, "update"), "product", productId, {
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
    stockMoves = optionWrite.stockMoves;
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

  return {
    savedAt: savedAt ?? undefined,
    success:
      stockMoves > 0
        ? `Product saved. Stock updated for ${stockMoves} combination${stockMoves === 1 ? "" : "s"}.`
        : "Product saved.",
  };
}
