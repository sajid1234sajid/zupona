"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { invalidateCatalog } from "@/lib/cache";
import { logAdminAction } from "@/lib/admin";
import { requireApprovedSeller } from "@/lib/sellers";
import { getShopSettings } from "@/lib/shopSettings";
import { sellerUrl } from "@/lib/panelUrl";
import {
  createProductFromForm,
  toFormError,
  updateProductFromForm,
  type ProductFormState,
  type ProductOwner,
} from "@/lib/productSave";

/** Every Seller Center product action starts here: the store comes from the
 * session (or, for an admin, from the store they picked), never from a form. */
async function sellerContext(): Promise<{ actorId: string; owner: ProductOwner & { kind: "seller" } }> {
  const [{ user, seller }, settings] = await Promise.all([requireApprovedSeller(), getShopSettings()]);
  return {
    actorId: user.id,
    owner: { kind: "seller", sellerId: seller.id, needsReview: settings.sellerProductsNeedReview },
  };
}

function refresh(productId?: string): void {
  revalidatePath("/seller/products");
  if (productId) revalidatePath(`/seller/products/${productId}`);
  revalidatePath("/seller");
  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function createSellerProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  let productId: string;

  try {
    const result = await createProductFromForm(formData, await sellerContext());
    if ("error" in result) return { error: result.error };
    productId = result.productId;
  } catch (error) {
    return toFormError(error);
  }

  refresh(productId);
  redirect((await sellerUrl(`/seller/products/${productId}`)) + "?saved=1");
}

export async function updateSellerProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  let state: ProductFormState;

  try {
    state = await updateProductFromForm(formData, await sellerContext());
  } catch (error) {
    return toFormError(error);
  }

  if (!state.error) refresh(String(formData.get("productId") ?? ""));
  return state;
}

/** The status changes a seller can make from the product list without
 * opening the form. Each is conditional on the row's current status and on
 * the row being this store's, so a stale list or a forged id writes nothing.
 *
 *  - archive: retire it (history kept -- a hard delete would erase the order
 *    lines and reviews that point at it),
 *  - restore: bring an archived product back as a draft,
 *  - submit: put a draft or a rejected product forward -- for review when the
 *    shop reviews sellers' products, straight to live when it does not,
 *  - unpublish: take a live product off the shelf as a draft. */
export async function setSellerProductStatusAction(formData: FormData): Promise<void> {
  const { actorId, owner } = await sellerContext();
  const productId = String(formData.get("productId") ?? "");
  const move = String(formData.get("move") ?? "");
  if (!productId) return;

  const moves: Record<string, { to: string; from: string[] }> = {
    archive: { to: "archived", from: ["draft", "pending_review", "active", "rejected"] },
    restore: { to: "draft", from: ["archived"] },
    submit: { to: owner.needsReview ? "pending_review" : "active", from: ["draft", "rejected"] },
    unpublish: { to: "draft", from: ["active", "pending_review"] },
  };
  const plan = moves[move];
  if (!plan) return;

  const db = await getDB();
  const result = await db
    .prepare(
      `UPDATE products SET status = ?, rejection_reason = NULL, updated_at = datetime('now')
       WHERE id = ? AND seller_id = ? AND status IN (${plan.from.map(() => "?").join(",")})`
    )
    .bind(plan.to, productId, owner.sellerId, ...plan.from)
    .run();

  if ((result.meta.changes ?? 0) === 0) return;

  await logAdminAction(actorId, `seller.product.${move}`, "product", productId, {
    after: { status: plan.to },
  });
  await invalidateCatalog();
  refresh(productId);
}
