/** Wishlist sort options.
 *
 * Its own module because both sides need it: the page (a Server Component)
 * validates `?sort=` with `isWishlistSort`, and the toolbar (a Client
 * Component) renders the labels. Keeping it out of `src/lib/wishlist.ts`
 * means the client bundle never pulls in `getDB` and the D1 binding.
 */

import type { WishlistSort } from "@/types";

export const WISHLIST_SORTS: { id: WishlistSort; label: string }[] = [
  { id: "recent", label: "Recently added" },
  { id: "price_asc", label: "Price: Low to High" },
  { id: "price_desc", label: "Price: High to Low" },
  { id: "discount", label: "Biggest discount" },
];

export function isWishlistSort(value: string | undefined): value is WishlistSort {
  return WISHLIST_SORTS.some((sort) => sort.id === value);
}
