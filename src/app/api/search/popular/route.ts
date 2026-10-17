/** "Popular right now" for the search box: the popular queries, each with a
 * picture of the product it finds first, so the chips show what they lead to.
 * The same for every shopper, so it is cached at the edge. */

import { listStoreCategories, listStoreProducts } from "@/lib/storefront";
import { categoryWordsOf, searchCatalog, searchTerms } from "@/lib/productSearch";
import { getPopularSearches } from "@/lib/searchInsights";

export async function GET() {
  const [popular, catalog, categories] = await Promise.all([
    getPopularSearches(12),
    listStoreProducts({ sort: "popular" }),
    listStoreCategories(),
  ]);
  const words = categoryWordsOf(categories);

  // With no search history and no list from the admin yet, the departments
  // stand in, so the panel is never empty on a new shop.
  const terms = popular.length > 0 ? popular : categories.slice(0, 8).map((c) => c.name);

  const queries = terms
    .map((q) => {
      const { products, corrected } = searchCatalog(catalog, searchTerms(q), words);
      // A misspelling is not offered back to shoppers, however often it was
      // typed; nor is a query that finds nothing today.
      return { q, thumb: corrected ? null : (products[0]?.image ?? null) };
    })
    .filter((entry) => entry.thumb !== null);

  return new Response(JSON.stringify({ queries }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
}
