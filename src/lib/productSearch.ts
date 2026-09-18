/** Product search, shared by the home page's box and `/api/search`.
 *
 * The home page filters the catalog it already holds in the browser, and every
 * other page asks `/api/search`, which filters the same catalog on the server.
 * They used to match differently -- the home page on the name alone -- so the
 * same words found a product on one page and nothing on the other. Both run
 * this now, so a search answers the same wherever it is typed.
 *
 * A product matches when every word typed appears somewhere in its name, its
 * brand, the tags the admin panel gave it, or its department's and
 * sub-department's names. Words can come in any order and from different
 * places, so "men shirt" finds a shirt filed under Men's Fashion whose name
 * never says "men". Nothing here touches the server, so the browser can run it.
 */

import type { StoreCategory, StoreProductCard } from "@/lib/storefront";

/** Category id -> the words a shopper might type to mean it. A sub-department
 * holds only its own name: a product carries both its department and its
 * sub-department, and both are searched. The home page ships this map to the
 * browser, so it holds nothing twice. */
export type CategoryWords = Record<string, string>;

export function categoryWordsOf(categories: StoreCategory[]): CategoryWords {
  const words: CategoryWords = {};
  for (const category of categories) {
    words[category.id] = normalize(category.name);
    for (const sub of category.subcategories) {
      words[sub.id] = normalize(sub.name);
    }
  }
  return words;
}

/** Lowercased, with punctuation turned into spaces, so "#Summer", "t-shirt"
 * and "Men's" meet what a shopper types: "summer", "t shirt", "mens". Letters
 * of any script survive, Bangla included. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

/** A product's name and keywords, normalized once rather than on every
 * keystroke. The home page searches the same catalog objects for each letter
 * typed, and the normalizing was nearly all of a keystroke's cost. */
const normalizedCache = new WeakMap<StoreProductCard, { name: string; keywords: string }>();

function normalizedText(product: StoreProductCard): { name: string; keywords: string } {
  let text = normalizedCache.get(product);
  if (!text) {
    text = {
      name: normalize(product.name),
      // A catalog cached before keywords existed has none; it lasts two minutes.
      keywords: normalize(product.keywords ?? ""),
    };
    normalizedCache.set(product, text);
  }
  return text;
}

/** The words of a query, ready to match. Empty when there is nothing to search. */
export function searchTerms(query: string): string[] {
  return normalize(query).split(" ").filter(Boolean);
}

/** The products matching every term, best first.
 *
 * A name that starts with the first word leads, then a name containing it,
 * then a match on brand or tag, then one that only came from the department.
 * Ties keep the order the products arrived in -- `Array.prototype.sort` is
 * stable -- which for the catalog is most popular first. */
export function searchProducts<T extends StoreProductCard>(
  products: T[],
  terms: string[],
  categoryWords: CategoryWords
): T[] {
  if (terms.length === 0) return products;

  const ranked: { product: T; score: number }[] = [];
  for (const product of products) {
    const { name, keywords } = normalizedText(product);
    const haystack = [
      name,
      keywords,
      categoryWords[product.categoryId ?? ""] ?? "",
      categoryWords[product.subcategoryId ?? ""] ?? "",
    ].join(" ");

    if (!terms.every((term) => haystack.includes(term))) continue;

    const first = terms[0];
    const score = name.startsWith(first)
      ? 0
      : name.includes(first)
        ? 1
        : keywords.includes(first)
          ? 2
          : 3;
    ranked.push({ product, score });
  }

  ranked.sort((a, b) => a.score - b.score);
  return ranked.map((entry) => entry.product);
}
