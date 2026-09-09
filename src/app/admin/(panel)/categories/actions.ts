"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { invalidateCatalog } from "@/lib/cache";
import { AuthorizationError, logAdminAction, requireAdmin } from "@/lib/admin";

export interface CategoryFormState {
  error?: string;
  success?: string;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "category"
  );
}

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const db = await getDB();
  let candidate = base;

  for (let attempt = 2; attempt < 60; attempt += 1) {
    const clash = await db
      .prepare("SELECT id FROM categories WHERE slug = ? AND id != ?")
      .bind(candidate, exceptId ?? "")
      .first<{ id: string }>();
    if (!clash) return candidate;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function refresh(): void {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/categories");
  revalidatePath("/");
}

function toFormError(error: unknown): CategoryFormState {
  if (error instanceof AuthorizationError) return { error: error.message };
  throw error;
}

export async function createCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  try {
    const admin = await requireAdmin();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Enter a category name." };

    const parentId = String(formData.get("parentId") ?? "").trim() || null;

    // Two levels is what the storefront's category browser renders; allowing a
    // third would create categories no page could reach.
    if (parentId) {
      const db = await getDB();
      const parent = await db
        .prepare("SELECT parent_id FROM categories WHERE id = ?")
        .bind(parentId)
        .first<{ parent_id: string | null }>();

      if (!parent) return { error: "That parent category no longer exists." };
      if (parent.parent_id) {
        return { error: "Categories only go two levels deep." };
      }
    }

    const db = await getDB();
    const id = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO categories (id, parent_id, name, slug, subtitle, image_url, icon,
                                 sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        parentId,
        name,
        await uniqueSlug(slugify(name)),
        String(formData.get("subtitle") ?? "").trim() || null,
        String(formData.get("image") ?? "").trim() || null,
        String(formData.get("icon") ?? "").trim() || null,
        Number(formData.get("sortOrder") ?? 0) || 0,
        formData.get("isActive") === null ? 1 : 1
      )
      .run();

    await logAdminAction(admin.id, "category.create", "category", id, { after: { name, parentId } });
    await invalidateCatalog();
  } catch (error) {
    return toFormError(error);
  }

  refresh();
  return { success: "Category added." };
}

export async function updateCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  try {
    const admin = await requireAdmin();

    const id = String(formData.get("categoryId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    if (!id || !name) return { error: "Enter a category name." };

    const db = await getDB();
    const before = await db
      .prepare("SELECT name, slug FROM categories WHERE id = ?")
      .bind(id)
      .first<{ name: string; slug: string }>();

    if (!before) return { error: "That category no longer exists." };

    const slug = before.name === name ? before.slug : await uniqueSlug(slugify(name), id);

    await db
      .prepare(
        `UPDATE categories SET name = ?, slug = ?, subtitle = ?, image_url = ?, icon = ?,
                               sort_order = ?
         WHERE id = ?`
      )
      .bind(
        name,
        slug,
        String(formData.get("subtitle") ?? "").trim() || null,
        String(formData.get("image") ?? "").trim() || null,
        String(formData.get("icon") ?? "").trim() || null,
        Number(formData.get("sortOrder") ?? 0) || 0,
        id
      )
      .run();

    await logAdminAction(admin.id, "category.update", "category", id, { before, after: { name } });
    await invalidateCatalog();
  } catch (error) {
    return toFormError(error);
  }

  refresh();
  return { success: "Category saved." };
}

/** Hiding a parent hides its subcategories too, otherwise a "hidden" section
 * would still be reachable through its own children. */
export async function toggleCategoryAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("categoryId") ?? "");
  if (!id) return;

  const db = await getDB();
  const row = await db
    .prepare("SELECT is_active FROM categories WHERE id = ?")
    .bind(id)
    .first<{ is_active: number }>();

  if (!row) return;
  const next = row.is_active === 1 ? 0 : 1;

  await db.batch([
    db.prepare("UPDATE categories SET is_active = ? WHERE id = ?").bind(next, id),
    db.prepare("UPDATE categories SET is_active = ? WHERE parent_id = ?").bind(next, id),
  ]);

  await logAdminAction(admin.id, next === 1 ? "category.show" : "category.hide", "category", id);
  await invalidateCatalog();
  refresh();
}

/** Refuses while anything still points at the category.
 *
 * The foreign keys are ON DELETE SET NULL, so a delete would silently
 * un-categorise products and orphan subcategories rather than failing. Saying
 * so is more useful than quietly doing it. */
export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("categoryId") ?? "");
  if (!id) return;

  const db = await getDB();
  const usage = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM products WHERE category_id = ?) AS products,
              (SELECT COUNT(*) FROM categories WHERE parent_id = ?) AS children`
    )
    .bind(id, id)
    .first<{ products: number; children: number }>();

  if ((usage?.products ?? 0) > 0 || (usage?.children ?? 0) > 0) return;

  await db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  await logAdminAction(admin.id, "category.delete", "category", id);
  await invalidateCatalog();
  refresh();
}
