"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { invalidateCatalog } from "@/lib/cache";
import { AuthorizationError, logAdminAction, requireAdmin } from "@/lib/admin";

export interface MarketingFormState {
  error?: string;
  success?: string;
}

const PLACEMENTS = ["hero", "promo", "discover"];

function refresh(): void {
  revalidatePath("/admin/marketing");
  revalidatePath("/");
  revalidatePath("/offers");
}

function toFormError(error: unknown): MarketingFormState {
  if (error instanceof AuthorizationError) return { error: error.message };
  throw error;
}

/* -------------------------------------------------------------------------- */
/* Banners                                                                    */
/* -------------------------------------------------------------------------- */

export async function createBannerAction(
  _prevState: MarketingFormState,
  formData: FormData
): Promise<MarketingFormState> {
  try {
    const admin = await requireAdmin();

    const title = String(formData.get("title") ?? "").trim();
    if (!title) return { error: "Enter a headline for the banner." };

    const placement = String(formData.get("placement") ?? "hero");
    if (!PLACEMENTS.includes(placement)) return { error: "Pick where the banner should appear." };

    const linkUrl = String(formData.get("linkUrl") ?? "").trim() || null;
    // Only same-site paths: an admin pasting a full URL by mistake would
    // otherwise send shoppers off the storefront from the homepage.
    if (linkUrl && !linkUrl.startsWith("/")) {
      return { error: "The link has to be a path on your site, starting with /" };
    }

    const db = await getDB();
    const id = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO banners (id, title, subtitle, image_url, link_url, placement,
                              sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .bind(
        id,
        title,
        String(formData.get("subtitle") ?? "").trim() || null,
        String(formData.get("image") ?? "").trim() || null,
        linkUrl,
        placement,
        Number(formData.get("sortOrder") ?? 0) || 0
      )
      .run();

    await logAdminAction(admin.id, "banner.create", "banner", id, { after: { title, placement } });
    await invalidateCatalog();
  } catch (error) {
    return toFormError(error);
  }

  refresh();
  return { success: "Banner published." };
}

export async function toggleBannerAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const bannerId = String(formData.get("bannerId") ?? "");
  if (!bannerId) return;

  const db = await getDB();
  const row = await db
    .prepare("SELECT is_active FROM banners WHERE id = ?")
    .bind(bannerId)
    .first<{ is_active: number }>();

  if (!row) return;
  const next = row.is_active === 1 ? 0 : 1;

  await db.prepare("UPDATE banners SET is_active = ? WHERE id = ?").bind(next, bannerId).run();
  await logAdminAction(admin.id, next === 1 ? "banner.show" : "banner.hide", "banner", bannerId);
  await invalidateCatalog();
  refresh();
}

export async function deleteBannerAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const bannerId = String(formData.get("bannerId") ?? "");
  if (!bannerId) return;

  const db = await getDB();
  await db.prepare("DELETE FROM banners WHERE id = ?").bind(bannerId).run();
  await logAdminAction(admin.id, "banner.delete", "banner", bannerId);
  await invalidateCatalog();
  refresh();
}

/* -------------------------------------------------------------------------- */
/* Broadcasts                                                                 */
/* -------------------------------------------------------------------------- */

/** Sends an in-app notification to a segment of customers.
 *
 * Written straight into `notifications` in batches rather than one statement
 * per person: D1 caps how much a single batch may carry, and a store with
 * thousands of customers would otherwise fail the whole send. */
export async function broadcastAction(
  _prevState: MarketingFormState,
  formData: FormData
): Promise<MarketingFormState> {
  let sent = 0;

  try {
    const admin = await requireAdmin();

    const title = String(formData.get("title") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();
    if (!title || !body) return { error: "A broadcast needs both a title and a message." };

    const segment = String(formData.get("segment") ?? "all");
    const db = await getDB();

    // Guests have no account to read a notification in.
    const where =
      segment === "buyers"
        ? "WHERE status = 'active' AND role != 'guest' AND EXISTS (SELECT 1 FROM orders o WHERE o.user_id = users.id)"
        : segment === "inactive"
          ? `WHERE status = 'active' AND role != 'guest'
             AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = users.id
                             AND o.placed_at >= datetime('now', '-90 days'))`
          : "WHERE status = 'active' AND role != 'guest'";

    const { results: recipients } = await db
      .prepare(`SELECT id FROM users ${where} LIMIT 5000`)
      .all<{ id: string }>();

    if (recipients.length === 0) {
      return { error: "No customers match that segment." };
    }

    const CHUNK = 50;
    for (let index = 0; index < recipients.length; index += CHUNK) {
      const chunk = recipients.slice(index, index + CHUNK);
      await db.batch(
        chunk.map((recipient) =>
          db
            .prepare(
              `INSERT INTO notifications (id, user_id, title, body, type)
               VALUES (?, ?, ?, ?, 'promo')`
            )
            .bind(crypto.randomUUID(), recipient.id, title.slice(0, 120), body.slice(0, 500))
        )
      );
      sent += chunk.length;
    }

    await logAdminAction(admin.id, "marketing.broadcast", "notification", null, {
      after: { title, segment, recipients: sent },
    });
  } catch (error) {
    return toFormError(error);
  }

  refresh();
  return { success: `Sent to ${sent} customer${sent === 1 ? "" : "s"}.` };
}

/* -------------------------------------------------------------------------- */
/* Flash sales                                                                */
/* -------------------------------------------------------------------------- */

export async function createFlashSaleAction(
  _prevState: MarketingFormState,
  formData: FormData
): Promise<MarketingFormState> {
  try {
    const admin = await requireAdmin();

    const name = String(formData.get("name") ?? "").trim();
    const startsAt = String(formData.get("startsAt") ?? "").trim();
    const endsAt = String(formData.get("endsAt") ?? "").trim();

    if (!name) return { error: "Give the sale a name." };
    if (!startsAt || !endsAt) return { error: "A flash sale needs a start and an end." };
    if (endsAt <= startsAt) return { error: "The sale has to end after it starts." };

    const db = await getDB();
    const id = crypto.randomUUID();

    await db
      .prepare(
        "INSERT INTO flash_sales (id, name, starts_at, ends_at, is_active) VALUES (?, ?, ?, ?, 1)"
      )
      .bind(
        id,
        name,
        `${startsAt.replace("T", " ")}:00`.slice(0, 19),
        `${endsAt.replace("T", " ")}:00`.slice(0, 19)
      )
      .run();

    await logAdminAction(admin.id, "flashsale.create", "flash_sale", id, { after: { name } });
    await invalidateCatalog();
  } catch (error) {
    return toFormError(error);
  }

  refresh();
  return { success: "Flash sale scheduled. Add products to it below." };
}

/** Puts a product into a running sale at a fixed price. The sale price is
 * validated against today's price so a "sale" can't accidentally be dearer
 * than the normal one. */
export async function addFlashSaleItemAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const saleId = String(formData.get("saleId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const salePrice = Number.parseInt(String(formData.get("salePrice") ?? "0"), 10);

  if (!saleId || !productId || !Number.isFinite(salePrice) || salePrice <= 0) return;

  const db = await getDB();
  const product = await db
    .prepare("SELECT price FROM products WHERE id = ?")
    .bind(productId)
    .first<{ price: number }>();

  if (!product || salePrice >= product.price) return;

  const stockLimit = Number.parseInt(String(formData.get("stockLimit") ?? "0"), 10);
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO flash_sale_items (id, flash_sale_id, product_id, sale_price, stock_limit)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, saleId, productId, salePrice, stockLimit > 0 ? stockLimit : null)
    .run();

  await logAdminAction(admin.id, "flashsale.additem", "flash_sale", saleId, {
    after: { productId, salePrice },
  });
  await invalidateCatalog();
  refresh();
}

export async function toggleFlashSaleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const saleId = String(formData.get("saleId") ?? "");
  if (!saleId) return;

  const db = await getDB();
  const row = await db
    .prepare("SELECT is_active FROM flash_sales WHERE id = ?")
    .bind(saleId)
    .first<{ is_active: number }>();

  if (!row) return;
  const next = row.is_active === 1 ? 0 : 1;

  await db.prepare("UPDATE flash_sales SET is_active = ? WHERE id = ?").bind(next, saleId).run();
  await logAdminAction(admin.id, next === 1 ? "flashsale.start" : "flashsale.stop", "flash_sale", saleId);
  await invalidateCatalog();
  refresh();
}
