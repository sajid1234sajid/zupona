/** Category tree lookups and category-scoped product queries.
 *
 * This used to read the hardcoded catalog in `src/data/`. It now reads the
 * database through `src/lib/storefront.ts`, which is what makes a category
 * created or renamed in the admin panel appear on the shop. The function
 * names are unchanged so the pages that call them did not have to be
 * rewritten -- but they are asynchronous now, because the data comes from D1.
 *
 * Sorting and filtering happen in SQL rather than in JavaScript: the catalog
 * is no longer a fixed array that can be held in memory. */

import {
  getStoreCategory,
  getStoreSubcategory,
  listCategoryOverviews,
  listStoreCategories,
  listStoreProducts,
  type StoreCategory,
  type StoreCategoryOverview,
  type StoreProductCard,
  type StoreSort,
  type StoreSubcategory,
} from "@/lib/storefront";
import type { ProductSummary } from "@/types";
import type { CategorySort } from "@/lib/categorySorts";

// Re-exported so existing server-side imports keep working; the definitions
// live in a database-free module because a client component needs them.
export { CATEGORY_SORTS, isCategorySort, type CategorySort } from "@/lib/categorySorts";

/** Kept for the components that already import this name. */
export type CategoryOverview = StoreCategoryOverview;

export async function getCategory(categoryId: string): Promise<StoreCategory | undefined> {
  return getStoreCategory(categoryId);
}

export async function getSubcategory(
  categoryId: string,
  subcategoryId: string
): Promise<StoreSubcategory | undefined> {
  return getStoreSubcategory(categoryId, subcategoryId);
}

export async function categoryName(categoryId: string | null): Promise<string> {
  if (!categoryId) return "Uncategorised";
  const category = await getStoreCategory(categoryId);
  if (category) return category.name;

  // The id may name a subcategory rather than a department.
  const all = await listStoreCategories();
  for (const department of all) {
    const sub = department.subcategories.find((entry) => entry.id === categoryId);
    if (sub) return sub.name;
  }
  return "Uncategorised";
}

/** Trims a catalog row to the shape client components receive. The database
 * row already carries only serializable values, so this is a narrowing rather
 * than the icon-stripping it used to be. */
export function toSummary(product: StoreProductCard): ProductSummary {
  return {
    id: product.id,
    name: product.name,
    image: product.image,
    price: product.price,
    oldPrice: product.oldPrice,
    discountPercent: product.discountPercent,
    rating: product.rating,
    reviews: product.reviews,
  };
}

export interface CategoryQuery {
  categoryId: string;
  subcategoryId?: string;
  sort?: CategorySort;
  /** Only products with a discount of at least this many percent. */
  minDiscount?: number;
  maxPrice?: number;
}

export async function productsInCategory(query: CategoryQuery): Promise<StoreProductCard[]> {
  return listStoreProducts({
    categoryId: query.categoryId,
    subcategoryId: query.subcategoryId,
    sort: query.sort ?? "popular",
    minDiscount: query.minDiscount,
    maxPrice: query.maxPrice,
  });
}

export async function countInCategory(categoryId: string): Promise<number> {
  const category = await getStoreCategory(categoryId);
  return category?.productCount ?? 0;
}

export async function categoryOverviews(highlightCount = 6): Promise<CategoryOverview[]> {
  return listCategoryOverviews(highlightCount);
}
