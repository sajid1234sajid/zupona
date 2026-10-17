/** Product search, shared by the home page's box, `/api/search` and `/search`.
 *
 * The home page filters the catalog it already holds in the browser, and every
 * other page asks the server, which filters the same catalog. They used to
 * match differently -- the home page on the name alone -- so the same words
 * found a product on one page and nothing on the other. All of them run this
 * now, so a search answers the same wherever it is typed.
 *
 * A product matches when every word typed appears somewhere in its name, its
 * brand, the tags the admin panel gave it, or its department's and
 * sub-department's names. Words can come in any order and from different
 * places, so "men shirt" finds a shirt filed under Men's Fashion whose name
 * never says "men".
 *
 * Two kinds of forgiveness on top of that:
 *
 *  - **Typos.** A word of 4-7 letters may be one slip away from a word in the
 *    product ("shrt" finds "shirt"), one of 8 or more two slips. Shorter words
 *    must be exact: at three letters one slip is usually another word. A
 *    product found only this way ranks below every exact match, and the
 *    search reports the corrected words so the page can say "Showing results
 *    for shirt".
 *  - **Bangla and Banglish.** Shoppers here type "শার্ট", "sart" or "jama"
 *    for a shirt. `ALIASES` maps the common ones to the English the catalog is
 *    written in; anything shop-specific belongs in the product's tags in the
 *    admin panel, which are searched as they are.
 *
 * Nothing here touches the server, so the browser can run it. */

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
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

/** Bangla script and Banglish spellings -> the English word the catalog uses.
 *
 * Only everyday product words, and each maps to words that really appear in
 * product names or department names. A term is searched as itself *and* as
 * these, so an English word that happens to be listed loses nothing. */
const ALIASES: Record<string, string[]> = {
  // clothing
  শার্ট: ["shirt"],
  sart: ["shirt"],
  shart: ["shirt"],
  jama: ["shirt", "dress"],
  জামা: ["shirt", "dress"],
  টিশার্ট: ["t shirt", "tshirt"],
  গেঞ্জি: ["t shirt", "tshirt", "vest"],
  genji: ["t shirt", "tshirt", "vest"],
  প্যান্ট: ["pant", "pants", "trouser"],
  pent: ["pant", "pants"],
  প্যান্টস: ["pant", "pants"],
  জিন্স: ["jeans"],
  pangabi: ["panjabi"],
  punjabi: ["panjabi"],
  পাঞ্জাবি: ["panjabi"],
  পাঞ্জাবী: ["panjabi"],
  শাড়ি: ["saree", "sari"],
  sari: ["saree"],
  shari: ["saree"],
  থ্রিপিস: ["three piece", "3 piece"],
  threepiece: ["three piece", "3 piece"],
  kurti: ["kurti", "kurta"],
  কুর্তি: ["kurti"],
  বোরকা: ["borka", "burqa", "abaya"],
  borka: ["burqa", "abaya"],
  হিজাব: ["hijab"],
  লুঙ্গি: ["lungi"],
  জ্যাকেট: ["jacket"],
  জুতা: ["shoe", "shoes", "sandal", "footwear"],
  juta: ["shoe", "shoes", "sandal", "footwear"],
  জুতো: ["shoe", "shoes"],
  স্যান্ডেল: ["sandal"],
  // accessories
  ঘড়ি: ["watch"],
  ghori: ["watch"],
  ব্যাগ: ["bag"],
  মানিব্যাগ: ["wallet"],
  manibag: ["wallet"],
  চশমা: ["glasses", "sunglasses"],
  // electronics
  লাইট: ["light", "lamp"],
  bati: ["light", "lamp"],
  বাতি: ["light", "lamp"],
  ফ্যান: ["fan"],
  মোবাইল: ["mobile", "phone"],
  ফোন: ["phone", "mobile"],
  চার্জার: ["charger"],
  হেডফোন: ["headphone", "headphones"],
  ইয়ারফোন: ["earphone", "earphones", "earbuds"],
  // beauty and baby
  ক্রিম: ["cream"],
  তেল: ["oil"],
  tel: ["oil"],
  সাবান: ["soap"],
  saban: ["soap"],
  শ্যাম্পু: ["shampoo"],
  বাচ্চা: ["baby", "kids"],
  baccha: ["baby", "kids"],
  খেলনা: ["toy", "toys"],
  khelna: ["toy", "toys"],
  // who it is for
  ছেলে: ["men", "mens", "boys"],
  chele: ["men", "mens", "boys"],
  মেয়ে: ["women", "womens", "girls"],
  meye: ["women", "womens", "girls"],
  মহিলা: ["women", "womens"],
  পুরুষ: ["men", "mens"],
};

/** A product's searchable text, normalized once rather than on every
 * keystroke. The home page searches the same catalog objects for each letter
 * typed, and the normalizing was nearly all of a keystroke's cost. */
interface Indexed {
  name: string;
  keywords: string;
  /** Every distinct word of the name and keywords, for typo matching. */
  words: string[];
}

const indexCache = new WeakMap<StoreProductCard, Indexed>();

function indexed(product: StoreProductCard): Indexed {
  let entry = indexCache.get(product);
  if (!entry) {
    const name = normalize(product.name);
    // A catalog cached before keywords existed has none; it lasts two minutes.
    const keywords = normalize(product.keywords ?? "");
    entry = { name, keywords, words: Array.from(new Set(`${name} ${keywords}`.split(" "))) };
    indexCache.set(product, entry);
  }
  return entry;
}

/** The words of a query, ready to match. Empty when there is nothing to search. */
export function searchTerms(query: string): string[] {
  return normalize(query).split(" ").filter(Boolean);
}

/** How many slips a word may carry. Measured on the word typed. */
function allowedTypos(term: string): number {
  if (term.length >= 8) return 2;
  if (term.length >= 4) return 1;
  return 0;
}

/** Edit distance with adjacent swaps counted as one slip ("sihrt"), giving
 * up as soon as it is certain to exceed `max`. Code points, not UTF-16 units,
 * so a Bangla letter counts once. */
export function editDistance(a: string, b: string, max: number): number {
  const s = Array.from(a);
  const t = Array.from(b);
  if (Math.abs(s.length - t.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      row.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[t.length];
}

/** The word in `words` a mistyped term most likely meant, or null.
 *
 * A word matches whole ("shrt" -> "shirt") or by its start, so a half-typed
 * word with a slip in it still completes ("panjab" -> "panjabi"). */
function closestWord(term: string, words: string[]): string | null {
  const max = allowedTypos(term);
  if (max === 0) return null;
  let best: string | null = null;
  let bestDistance = max + 1;
  for (const word of words) {
    if (word.length < 3) continue;
    const whole = editDistance(term, word, max);
    const start =
      word.length > term.length ? editDistance(term, word.slice(0, term.length), max) : whole;
    const d = Math.min(whole, start);
    if (d < bestDistance) {
      bestDistance = d;
      best = word;
      if (d === 0) break;
    }
  }
  return bestDistance <= max ? best : null;
}

/** What one term found in one product: an exact hit, a typo-corrected hit
 * (with the word it was corrected to), or nothing. */
type TermHit = { exact: true } | { exact: false; word: string } | null;

/** A term matches from the start of a word, never from its middle: "men"
 * must not find everything filed under Women's Fashion. The haystack is
 * padded with a space so the first word starts after one too. */
function matchTerm(term: string, haystack: string, words: string[]): TermHit {
  const alternatives = [term, ...(ALIASES[term] ?? [])];
  if (alternatives.some((alt) => haystack.includes(` ${alt}`))) return { exact: true };
  const word = closestWord(term, words);
  return word ? { exact: false, word } : null;
}

export interface SearchOutcome<T> {
  products: T[];
  /** The query as it was understood, when a typo was corrected to find these
   * results -- "shirt" for "shrt". Null when every word matched as typed. */
  corrected: string | null;
}

/** Every product matching every term, best first, and the corrected query
 * when the matches needed one.
 *
 * Exact matches always lead; within them, a name that starts with the first
 * word comes first, then a name containing it, then a match on brand or tag,
 * then one that only came from the department. Ties keep the order the
 * products arrived in -- `Array.prototype.sort` is stable -- which for the
 * catalog is most popular first. */
export function searchCatalog<T extends StoreProductCard>(
  products: T[],
  terms: string[],
  categoryWords: CategoryWords
): SearchOutcome<T> {
  if (terms.length === 0) return { products, corrected: null };

  const ranked: { product: T; score: number }[] = [];
  // Per term, how often each correction was the one that matched; the most
  // common wins when the corrected query is spelled out.
  const corrections = terms.map(() => new Map<string, number>());

  for (const product of products) {
    const { name, keywords, words } = indexed(product);
    const categoryText = [
      categoryWords[product.categoryId ?? ""] ?? "",
      categoryWords[product.subcategoryId ?? ""] ?? "",
    ].join(" ");
    const haystack = ` ${name} ${keywords} ${categoryText}`;
    const allWords = categoryText ? [...words, ...categoryText.split(" ")] : words;

    let fuzzy = 0;
    const hits: TermHit[] = [];
    for (const term of terms) {
      const hit = matchTerm(term, haystack, allWords);
      if (!hit) break;
      if (!hit.exact) fuzzy++;
      hits.push(hit);
    }
    if (hits.length < terms.length) continue;

    hits.forEach((hit, i) => {
      if (hit && !hit.exact) corrections[i].set(hit.word, (corrections[i].get(hit.word) ?? 0) + 1);
    });

    const first = terms[0];
    const place = name.startsWith(first)
      ? 0
      : ` ${name}`.includes(` ${first}`)
        ? 1
        : ` ${keywords}`.includes(` ${first}`)
          ? 2
          : 3;
    ranked.push({ product, score: fuzzy * 10 + place });
  }

  ranked.sort((a, b) => a.score - b.score);

  // Spell the correction out only when nothing matched exactly: if "shrt"
  // found real products as typed, there is nothing to correct.
  const anyExact = ranked.some((entry) => entry.score < 10);
  let corrected: string | null = null;
  if (!anyExact && ranked.length > 0) {
    corrected = terms
      .map((term, i) => {
        const options = [...corrections[i].entries()].sort((a, b) => b[1] - a[1]);
        return options[0]?.[0] ?? term;
      })
      .join(" ");
  }

  return { products: ranked.map((entry) => entry.product), corrected };
}

/** The products matching every term, best first. */
export function searchProducts<T extends StoreProductCard>(
  products: T[],
  terms: string[],
  categoryWords: CategoryWords
): T[] {
  return searchCatalog(products, terms, categoryWords).products;
}

/** Up to `limit` ways to finish what is being typed, drawn from the words the
 * catalog actually uses -- product names, brands, tags and departments -- so
 * every suggestion leads somewhere.
 *
 * Phrases of one to three words are taken from each product's text; a phrase
 * qualifies when it covers every typed word, the last one as a prefix (it is
 * still being typed). The most common phrases come first. */
export function suggestQueries(
  products: StoreProductCard[],
  query: string,
  categoryWords: CategoryWords,
  limit = 8
): string[] {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];

  const counts = new Map<string, number>();
  const add = (phrase: string) => counts.set(phrase, (counts.get(phrase) ?? 0) + 1);

  const sources: string[] = [];
  for (const product of products) {
    const { name, keywords } = indexed(product);
    sources.push(name);
    if (keywords) sources.push(keywords);
  }
  sources.push(...Object.values(categoryWords));

  const lead = terms.slice(0, -1);
  const last = terms[terms.length - 1];
  const lastAlternatives = [last, ...(ALIASES[last] ?? [])];

  for (const text of sources) {
    const words = text.split(" ").filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      for (let size = 1; size <= 3 && i + size <= words.length; size++) {
        const phrase = words.slice(i, i + size);
        // "shirts t" from "Shirts & T-Shirts": a phrase that starts or ends on
        // a stray letter is not something anyone types.
        if (phrase[0].length < 2 || phrase[phrase.length - 1].length < 2) continue;
        // The finished words must each be in the phrase, the last typed word
        // must start one of its words (or be one slip from doing so).
        const leadOk = lead.every((term) =>
          phrase.some((word) => word.startsWith(term) || closestWord(term, [word]) !== null)
        );
        if (!leadOk) continue;
        const lastOk = phrase.some(
          (word) =>
            lastAlternatives.some((alt) => word.startsWith(alt)) ||
            (last.length >= 4 && closestWord(last, [word]) !== null)
        );
        if (lastOk) add(phrase.join(" "));
      }
    }
  }

  const ordered = (map: Map<string, number>) =>
    [...map.entries()]
      .sort(
        (a, b) =>
          b[1] - a[1] ||
          a[0].split(" ").length - b[0].split(" ").length ||
          a[0].localeCompare(b[0])
      )
      .map(([phrase]) => phrase);

  const found = ordered(counts);
  if (found.length > 0 || lead.length === 0) return found.slice(0, limit);

  // "men shirt": the finished words often come from the department rather
  // than from any one phrase. Finish the last word on its own and keep what
  // was already typed in front of it.
  const finished = new Map<string, number>();
  for (const phrase of suggestQueries(products, last, categoryWords, limit)) {
    finished.set(`${lead.join(" ")} ${phrase}`, 1);
  }
  return [...finished.keys()].slice(0, limit);
}
