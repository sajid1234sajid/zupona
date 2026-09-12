/** Category-shaped helpers that are not part of the category *system*.
 *
 * The tree, its lookups and its mutations all live in
 * `src/lib/categoryService.ts`. What is left here is the two things the cart,
 * wishlist and offers pages need from a category without wanting the tree:
 * a product's category name, and the narrowing of a catalog row to the summary
 * shape client components receive.
 *
 * This module used to hold the lookups and the category-scoped product queries
 * too. Those moved to the service when categories grew a third level -- keeping
 * a second set of functions that answered the same questions two levels deep
 * was exactly the duplication that lets one page disagree with another. */

import type { StoreProductCard } from "@/lib/storefront";
import { getCategoryIndex } from "@/lib/categoryService";
import type { ProductSummary } from "@/types";

// Re-exported so existing server-side imports keep working; the definitions
// live in a database-free module because a client component needs them.
export { CATEGORY_SORTS, isCategorySort, type CategorySort } from "@/lib/categorySorts";

/** The display name for whatever category id a product row carries, at any
 * level of the tree. Reads the cached index rather than walking a projection
 * of it, so a level-three category resolves the same as a department. */
export async function categoryName(categoryId: string | null): Promise<string> {
  if (!categoryId) return "Uncategorised";
  const { byId } = await getCategoryIndex();
  return byId.get(categoryId)?.name ?? "Uncategorised";
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
