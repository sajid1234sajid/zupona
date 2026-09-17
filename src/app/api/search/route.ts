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
 * Matching is per word and covers the department and sub-department names as
 * well as the product's own, so "men shirt" finds a shirt filed under Men's
 * Fashion whose name never says "men". */

import { listStoreCategories, listStoreProducts } from "@/lib/storefront";
import type { StoreProductCard } from "@/lib/storefront";

/** Enough to scroll through, few enough to stay a small response. */
const LIMIT = 30;

interface Ranked {
  product: StoreProductCard;
  score: number;
}

/** Lower is better: a name that starts with what was typed comes first, then
 * one that contains it, then a match that only came from the category. */
function scoreOf(name: string, haystack: string, terms: string[]): number | null {
  for (const term of terms) {
    if (!haystack.includes(term)) return null;
  }

  const first = terms[0];
  if (name.startsWith(first)) return 0;
  if (name.includes(first)) return 1;
  return 2;
}

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();

  if (query.length === 0) {
    return json({ query, products: [] });
  }

  // Independent reads, so they start together rather than one after the other.
  const [catalog, categories] = await Promise.all([
    listStoreProducts({ sort: "popular" }),
    listStoreCategories(),
  ]);

  // Category id -> the words a shopper might type to mean it.
  const categoryWords = new Map<string, string>();
  for (const category of categories) {
    categoryWords.set(category.id, category.name.toLowerCase());
    for (const sub of category.subcategories) {
      categoryWords.set(sub.id, `${category.name} ${sub.name}`.toLowerCase());
    }
  }

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const ranked: Ranked[] = [];
  for (const product of catalog) {
    const name = product.name.toLowerCase();
    const haystack = [
      name,
      categoryWords.get(product.categoryId ?? "") ?? "",
      categoryWords.get(product.subcategoryId ?? "") ?? "",
    ].join(" ");

    const score = scoreOf(name, haystack, terms);
    if (score !== null) ranked.push({ product, score });
  }

  // The catalog arrives sorted by popularity, so an equal score keeps that
  // order -- Array.prototype.sort is stable.
  ranked.sort((a, b) => a.score - b.score);

  return json({
    query,
    total: ranked.length,
    products: ranked.slice(0, LIMIT).map(({ product }) => ({
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
