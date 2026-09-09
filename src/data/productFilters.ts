import type { ProductFilterOption } from "@/types";

/** The home page's filter chips.
 *
 * Presentation rather than catalog: each chip groups one or more departments
 * under a word shoppers actually use, so "Men" covers men's fashion *and*
 * men's accessories. The chips filter on `categoryId`, the department id the
 * database gives every product, which is why a chip can never disagree with
 * what tapping the same department in the grid above shows -- and why a new
 * product needs no chip of its own, only a correct category.
 *
 * It lives in its own module because the chip row is a client component:
 * importing it from `products.ts` would pull that whole file, and its lucide
 * icons, into the browser bundle for the sake of six lines. */
export const productFilters: ProductFilterOption[] = [
  { id: "All", categoryIds: [] },
  { id: "Men", categoryIds: ["mens-fashion", "mens-accessories"] },
  { id: "Women", categoryIds: ["womens-fashion", "womens-accessories"] },
  { id: "Electronics", categoryIds: ["electronics"] },
  { id: "Health & Beauty", categoryIds: ["health-beauty", "body-bath"] },
];
