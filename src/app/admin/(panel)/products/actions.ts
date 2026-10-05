"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { invalidateCatalog } from "@/lib/cache";
import { logAdminAction, requireAdmin } from "@/lib/admin";
import { setProductStatus } from "@/lib/catalog";
import { adminUrl } from "@/lib/panelUrl";
import { adjustStock } from "@/lib/inventory";
import {
  createProductFromForm,
  readInt,
  slugify,
  toFormError,
  updateProductFromForm,
  type ProductFormState,
} from "@/lib/productSave";
import type { ProductStatus } from "@/types";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function readText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
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

/** The admin panel creates the platform's own (first-party) products; a
 * seller's products are created from the Seller Center, through the same
 * save in `src/lib/productSave.ts`. */
export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  let productId: string;

  try {
    const admin = await requireAdmin();
    const result = await createProductFromForm(formData, {
      actorId: admin.id,
      owner: { kind: "platform" },
    });
    if ("error" in result) return { error: result.error };
    productId = result.productId;
  } catch (error) {
    return toFormError(error);
  }

  refreshProductViews(productId);
  redirect(await adminUrl(`/admin/products/${productId}`) + "?saved=1");
}

/** An admin may edit any product, a seller's included -- the platform answers
 * for everything on its storefront. */
export async function updateProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  let state: ProductFormState;

  try {
    const admin = await requireAdmin();
    state = await updateProductFromForm(formData, {
      actorId: admin.id,
      owner: { kind: "platform" },
    });
  } catch (error) {
    return toFormError(error);
  }

  if (!state.error) refreshProductViews(String(formData.get("productId") ?? ""));
  return state;
}

/* -------------------------------------------------------------------------- */
/* Reviewing sellers' products                                                */
/* -------------------------------------------------------------------------- */

/** Puts a seller's submitted product live. */
export async function approveProductAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return;

  await setProductStatus(productId, "active");
  await logAdminAction(admin.id, "product.approve", "product", productId, {
    after: { status: "active" },
  });
  await invalidateCatalog();
  refreshProductViews(productId);
}

/** Sends a seller's product back with the reason they will read in their
 * Seller Center. A rejection without a reason only produces a support message
 * asking for one, so the reason is required. */
export async function rejectProductAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!productId || !reason) return;

  await setProductStatus(productId, "rejected", reason);
  await logAdminAction(admin.id, "product.reject", "product", productId, {
    after: { status: "rejected", reason },
  });
  await invalidateCatalog();
  refreshProductViews(productId);
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
