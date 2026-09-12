"use server";

import { revalidatePath } from "next/cache";
import { AuthorizationError, logAdminAction, requireAdmin } from "@/lib/admin";
import {
  CategoryError,
  createCategory,
  deleteCategory,
  getAdminCategoryIndex,
  reorderCategories,
  setCategoryActive,
  updateCategory,
  type CategoryInput,
} from "@/lib/categoryService";

/** Category mutations for the admin panel.
 *
 * Every action starts with `requireAdmin()` -- a hidden button is not a
 * security boundary, and a server action can be invoked directly by anything
 * that knows its id. The rules themselves (depth, cycles, duplicate slugs, what
 * makes a category safe to delete) live in `src/lib/categoryService.ts` so this
 * file stays about authorization, form parsing and cache invalidation, and so a
 * rule cannot be enforced on one screen and forgotten on another.
 *
 * The service invalidates the catalog cache itself; what is left here is
 * `revalidatePath` for the rendered pages. */

export interface CategoryFormState {
  error?: string;
  success?: string;
}

function refresh(): void {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/categories");
  revalidatePath("/category", "layout");
  revalidatePath("/");
}

/** Turns the two expected failures into a form message and lets anything else
 * -- a genuine fault -- propagate to the error boundary. */
function toFormError(error: unknown): CategoryFormState {
  if (error instanceof CategoryError) return { error: error.message };
  if (error instanceof AuthorizationError) return { error: error.message };
  throw error;
}

const text = (formData: FormData, key: string): string => String(formData.get(key) ?? "").trim();

/** An unchecked box posts nothing at all, so its absence is what "off" looks
 * like. Only meaningful on a form that actually rendered the box -- which is
 * why the toggle actions below send an explicit value instead. */
const checkbox = (formData: FormData, key: string): boolean => formData.get(key) !== null;

function readInput(formData: FormData): CategoryInput {
  return {
    name: text(formData, "name"),
    nameBn: text(formData, "nameBn"),
    slug: text(formData, "slug"),
    parentId: text(formData, "parentId") || null,
    subtitle: text(formData, "subtitle"),
    descriptionEn: text(formData, "descriptionEn"),
    descriptionBn: text(formData, "descriptionBn"),
    imageUrl: text(formData, "image"),
    iconUrl: text(formData, "iconImage"),
    icon: text(formData, "icon"),
    seoTitle: text(formData, "seoTitle"),
    seoDescription: text(formData, "seoDescription"),
    isActive: checkbox(formData, "isActive"),
    isFeatured: checkbox(formData, "isFeatured"),
    showOnHomepage: checkbox(formData, "showOnHomepage"),
    showInNavigation: checkbox(formData, "showInNavigation"),
  };
}

export async function createCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  try {
    const admin = await requireAdmin();
    const input = readInput(formData);

    const sortOrder = Number(formData.get("sortOrder"));
    if (Number.isFinite(sortOrder) && text(formData, "sortOrder") !== "") {
      input.sortOrder = sortOrder;
    }

    const created = await createCategory(input);

    await logAdminAction(admin.id, "category.create", "category", created.id, {
      after: { name: created.name, slug: created.slug, parentId: created.parentId },
    });
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

    const id = text(formData, "categoryId");
    if (!id) return { error: "That category no longer exists." };

    const before = (await getAdminCategoryIndex()).byId.get(id);
    if (!before) return { error: "That category no longer exists." };

    const input = readInput(formData);
    const sortOrder = Number(formData.get("sortOrder"));
    if (Number.isFinite(sortOrder) && text(formData, "sortOrder") !== "") {
      input.sortOrder = sortOrder;
    }

    await updateCategory(id, input);

    await logAdminAction(admin.id, "category.update", "category", id, {
      before: { name: before.name, slug: before.slug, parentId: before.parentId },
      after: { name: input.name, slug: input.slug, parentId: input.parentId },
    });
  } catch (error) {
    return toFormError(error);
  }

  refresh();
  return { success: "Category saved." };
}

/** The four placement switches, through one action.
 *
 * The button posts `toggle` as "<flag>:<0|1>" -- flag and desired state in one
 * field, because a button carries a single value and one form per switch would
 * mean four nested forms in every tree row. The state is sent explicitly rather
 * than inferred: read as a checkbox, "absent" would mean "off" on every click.
 *
 * Which flags exist is decided here, not by the form: an unrecognised one is
 * ignored rather than written. */
export async function toggleCategoryFlagAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = text(formData, "categoryId");
  const [flag, rawValue] = text(formData, "toggle").split(":");
  const value = rawValue === "1";
  if (!id || !flag) return;

  try {
    switch (flag) {
      case "active":
        await setCategoryActive(id, value);
        break;
      case "featured":
        await updateCategory(id, { isFeatured: value });
        break;
      case "homepage":
        await updateCategory(id, { showOnHomepage: value });
        break;
      case "navigation":
        await updateCategory(id, { showInNavigation: value });
        break;
      default:
        return;
    }
  } catch (error) {
    // A toggle has nowhere to render a message; an invalid one is a no-op.
    if (!(error instanceof CategoryError)) throw error;
    return;
  }

  await logAdminAction(admin.id, `category.${flag}.${value ? "on" : "off"}`, "category", id);
  refresh();
}

/** Deletes a category, moving any products filed under it somewhere else.
 *
 * Refuses rather than cascading: the schema's ON DELETE SET NULL would leave
 * the products uncategorised, which looks like nothing happened until a
 * shopper cannot find them. */
export async function deleteCategoryAction(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const id = text(formData, "categoryId");

  try {
    const admin = await requireAdmin();
    if (!id) return { error: "That category no longer exists." };

    const before = (await getAdminCategoryIndex()).byId.get(id);
    await deleteCategory(id, { reassignTo: text(formData, "reassignTo") || null });

    await logAdminAction(admin.id, "category.delete", "category", id, {
      before: before ? { name: before.name, slug: before.slug } : undefined,
    });
  } catch (error) {
    return toFormError(error);
  }

  refresh();
  return { success: "Category deleted." };
}

/** Writes a new order for one level of the tree after a drag.
 *
 * The ids are the level's new order; the service ignores any that are not
 * actually siblings, so a tampered payload cannot re-parent a category here. */
export async function reorderCategoriesAction(
  parentId: string | null,
  orderedIds: string[]
): Promise<void> {
  const admin = await requireAdmin();
  await reorderCategories(parentId, orderedIds);
  await logAdminAction(admin.id, "category.reorder", "category", parentId ?? "root", {
    after: { order: orderedIds },
  });
  refresh();
}
