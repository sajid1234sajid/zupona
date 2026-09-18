/** Product search for the header's search sheet.
 *
 * The home page searches without a round trip -- it already holds the whole
 * catalog and filters it in the browser -- but every other page (offers,
 * categories, cart, a product page) holds nothing to filter, and the search
 * control on those headers used to do nothing at all. This is what those ask.
 *
 * It reads the same cached catalog the home page reads, with the same query
 * fingerprint, so in the normal case this is a KV hit rather than a trip to
 * D1 in Singapore. Only the matches cross the wire, so a search costs a few
 * kilobytes rather than the whole catalog.
 *
 * What matches is decided in `src/lib/productSearch.ts`, which the home page
 * runs too, so the same words find the same products on every page. */

import { listStoreCategories, listStoreProducts } from "@/lib/storefront";
import { categoryWordsOf, searchProducts, searchTerms } from "@/lib/productSearch";

/** Enough to scroll through, few enough to stay a small response. */
const LIMIT = 30;

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  const terms = searchTerms(query);

  // Punctuation alone has no words to match; it is not a request for everything.
  if (terms.length === 0) {
    return json({ query, products: [] });
  }

  // Independent reads, so they start together rather than one after the other.
  const [catalog, categories] = await Promise.all([
    listStoreProducts({ sort: "popular" }),
    listStoreCategories(),
  ]);

  const ranked = searchProducts(catalog, terms, categoryWordsOf(categories));

  return json({
    query,
    total: ranked.length,
    products: ranked.slice(0, LIMIT).map((product) => ({
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      oldPrice: product.oldPrice,
      discountPercent: product.discountPercent,
      rating: product.rating,
      reviews: product.reviews,
      inStock: product.inStock,
    })),
  });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      // The same answer for every shopper, and the catalog behind it is
      // itself only cached for two minutes.
      "Cache-Control": "public, max-age=60",
    },
  });
}
