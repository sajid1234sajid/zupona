/** Category sort options, kept apart from the queries that use them.
 *
 * `CategoryToolbar` is a client component and needs this list to render its
 * dropdown. Importing it from `@/lib/categories` would drag that module's
 * database access into the browser bundle -- and `cloudflare:workers` does not
 * resolve there, so the build fails outright. Splitting the constants out is
 * the same shape as `wishlistSorts.ts`. */

export type CategorySort =
  | "popular"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "discount";

export const CATEGORY_SORTS: { id: CategorySort; label: string }[] = [
  { id: "popular", label: "Popular" },
  { id: "newest", label: "Newest" },
  { id: "price_asc", label: "Price: Low to High" },
  { id: "price_desc", label: "Price: High to Low" },
  { id: "rating", label: "Top Rated" },
  { id: "discount", label: "Biggest Discount" },
];

export function isCategorySort(value: string | undefined): value is CategorySort {
  return CATEGORY_SORTS.some((sort) => sort.id === value);
}
