/** Filtering, sorting and facet counts for a product listing.
 *
 * The catalog is small enough to hold in one cached read (see
 * `listStoreProducts`), so a listing is that list narrowed in memory rather
 * than a new SQL query per combination of filters: every combination costs
 * the same KV hit, and the counts beside each filter come from the same pass.
 *
 * Counts are "what you would get if you also ticked this": each facet is
 * counted with every *other* active filter applied but not its own, so ticking
 * M beside a count of 12 never leads to an empty page, and the other sizes
 * still show what they would add. */

import { getDB } from "@/lib/db";
import { cached } from "@/lib/cache";
import { listStoreProducts, type StoreCategory, type StoreProductCard } from "@/lib/storefront";
import { PRICE_PRESETS, type ListingFilters } from "@/lib/listingParams";

export interface Facet {
  value: string;
  label: string;
  count: number;
}

export interface ListingFacets {
  categories: Facet[];
  brands: Facet[];
  sizes: Facet[];
  colors: Facet[];
  prices: Facet[];
  deals: number;
  freeDelivery: number;
  rating4: number;
}

/** product id -> the sizes and colours it is offered in. */
export type OptionIndex = Record<string, { sizes: string[]; colors: string[] }>;

/** Every active product's sizes and colours, from the canonical option tables.
 *
 * One query for the whole catalog, cached alongside it under the `catalog:`
 * prefix so an admin save clears both. Only `size` and `color` groups: they
 * are the two a shopper filters clothing by, and the only two the option
 * builder gives fixed keys to across products. */
export async function getOptionIndex(): Promise<OptionIndex> {
  return cached(
    "catalog:option-index",
    async () => {
      const db = await getDB();
      const { results } = await db
        .prepare(
          `SELECT g.product_id AS productId, g.key AS key, v.label AS label
           FROM product_option_groups g
           JOIN product_option_values v ON v.group_id = g.id
           JOIN products p ON p.id = g.product_id
           WHERE p.status = 'active' AND g.is_active = 1 AND v.is_active = 1
             AND g.key IN ('size', 'color')
           ORDER BY g.product_id, v.sort_order`
        )
        .all<{ productId: string; key: string; label: string }>();

      const index: OptionIndex = {};
      for (const row of results) {
        const entry = (index[row.productId] ??= { sizes: [], colors: [] });
        const label = row.label.trim();
        if (!label) continue;
        (row.key === "size" ? entry.sizes : entry.colors).push(label);
      }
      return index;
    },
    120
  );
}

/** Newest first, as the catalog's own `newest` read orders it: the card
 * carries no creation date, so the order is borrowed from that query. */
async function newestRank(): Promise<Map<string, number>> {
  const newest = await listStoreProducts({ sort: "newest" });
  return new Map(newest.map((product, i) => [product.id, i]));
}

const SIZE_ORDER = ["xxs", "xs", "s", "m", "l", "xl", "xxl", "2xl", "xxxl", "3xl", "4xl", "5xl"];

function sizeRank(label: string): number {
  const i = SIZE_ORDER.indexOf(label.toLowerCase());
  if (i >= 0) return i;
  const n = Number.parseFloat(label);
  return Number.isFinite(n) ? 100 + n : 10_000;
}

const key = (text: string) => text.trim().toLowerCase();

interface Predicates {
  category: (p: StoreProductCard) => boolean;
  price: (p: StoreProductCard) => boolean;
  sizes: (p: StoreProductCard) => boolean;
  colors: (p: StoreProductCard) => boolean;
  brands: (p: StoreProductCard) => boolean;
  deals: (p: StoreProductCard) => boolean;
  freeDelivery: (p: StoreProductCard) => boolean;
  rating4: (p: StoreProductCard) => boolean;
}

function predicates(filters: ListingFilters, options: OptionIndex): Predicates {
  const sizes = new Set(filters.sizes.map(key));
  const colors = new Set(filters.colors.map(key));
  const brands = new Set(filters.brands.map(key));
  const { price } = filters;
  return {
    category: (p) =>
      !filters.category || p.categoryId === filters.category || p.subcategoryId === filters.category,
    price: (p) => !price || (p.price >= price.min && (price.max === null || p.price <= price.max)),
    sizes: (p) => sizes.size === 0 || (options[p.id]?.sizes ?? []).some((s) => sizes.has(key(s))),
    colors: (p) => colors.size === 0 || (options[p.id]?.colors ?? []).some((c) => colors.has(key(c))),
    brands: (p) => brands.size === 0 || (p.brand ? brands.has(key(p.brand)) : false),
    deals: (p) => !filters.deals || p.oldPrice > p.price,
    freeDelivery: (p) => !filters.freeDelivery || p.freeDelivery,
    rating4: (p) => !filters.rating4 || (p.reviews > 0 && p.rating >= 4),
  };
}

/** Products passing every predicate except `skip`. */
function passing(
  products: StoreProductCard[],
  preds: Predicates,
  skip?: keyof Predicates
): StoreProductCard[] {
  const active = (Object.keys(preds) as (keyof Predicates)[]).filter((k) => k !== skip);
  return products.filter((p) => active.every((k) => preds[k](p)));
}

function tally(
  products: StoreProductCard[],
  valuesOf: (p: StoreProductCard) => string[],
  labelOf: (value: string) => string = (v) => v
): Facet[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const product of products) {
    // A product offered in M twice (two colours) counts once for M.
    for (const value of new Set(valuesOf(product).map((v) => v.trim()).filter(Boolean))) {
      const k = key(value);
      const entry = counts.get(k) ?? { label: labelOf(value), count: 0 };
      entry.count++;
      counts.set(k, entry);
    }
  }
  return [...counts.entries()].map(([value, { label, count }]) => ({ value, label, count }));
}

export interface ListingResult {
  items: StoreProductCard[];
  facets: ListingFacets;
}

/** Narrows `products` (already in relevance order) by `filters`, sorts them,
 * and counts every facet. */
export async function applyListing(
  products: StoreProductCard[],
  filters: ListingFilters,
  categories: StoreCategory[]
): Promise<ListingResult> {
  const [options, newest] = await Promise.all([
    getOptionIndex(),
    filters.sort === "newest" ? newestRank() : Promise.resolve(null),
  ]);
  const preds = predicates(filters, options);

  const categoryName = new Map<string, string>();
  for (const department of categories) {
    categoryName.set(department.id, department.name);
    for (const sub of department.subcategories) categoryName.set(sub.id, sub.name);
  }

  // Departments, and the selected department's sub-departments under it.
  const forCategories = passing(products, preds, "category");
  const selectedDepartment = categories.find(
    (d) =>
      d.id === filters.category || d.subcategories.some((sub) => sub.id === filters.category)
  );
  const categoryFacets = tally(
    forCategories,
    (p) => [p.categoryId ?? ""].filter((id) => categoryName.has(id)),
    (id) => categoryName.get(id) ?? id
  );
  if (selectedDepartment) {
    categoryFacets.push(
      ...tally(
        forCategories.filter((p) => p.categoryId === selectedDepartment.id),
        (p) => [p.subcategoryId ?? ""].filter((id) => categoryName.has(id)),
        (id) => `${categoryName.get(id) ?? id}`
      ).map((facet) => ({ ...facet, label: `› ${facet.label}` }))
    );
  }
  // Facet values are lowercased for matching; a category id is used as-is.
  for (const facet of categoryFacets) {
    facet.value = [...categoryName.keys()].find((id) => key(id) === facet.value) ?? facet.value;
  }

  const forPrice = passing(products, preds, "price");
  const prices = PRICE_PRESETS.map((preset) => ({
    value: preset.id,
    label: preset.label,
    count: forPrice.filter(
      (p) => p.price >= preset.min && (preset.max === null || p.price <= preset.max)
    ).length,
  }));

  const facets: ListingFacets = {
    categories: categoryFacets.sort((a, b) => b.count - a.count),
    brands: tally(passing(products, preds, "brands"), (p) => (p.brand ? [p.brand] : [])).sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label)
    ),
    sizes: tally(passing(products, preds, "sizes"), (p) => options[p.id]?.sizes ?? []).sort(
      (a, b) => sizeRank(a.label) - sizeRank(b.label) || a.label.localeCompare(b.label)
    ),
    colors: tally(passing(products, preds, "colors"), (p) => options[p.id]?.colors ?? []).sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label)
    ),
    prices,
    deals: passing(products, preds, "deals").filter((p) => p.oldPrice > p.price).length,
    freeDelivery: passing(products, preds, "freeDelivery").filter((p) => p.freeDelivery).length,
    rating4: passing(products, preds, "rating4").filter((p) => p.reviews > 0 && p.rating >= 4)
      .length,
  };

  const items = passing(products, preds);
  // Sold-out products stay findable but go to the end, whatever the sort.
  const sorted = sortListing(items, filters.sort, newest).sort(
    (a, b) => Number(!a.inStock) - Number(!b.inStock)
  );
  return { items: sorted, facets };
}

function sortListing(
  items: StoreProductCard[],
  sort: ListingFilters["sort"],
  newest: Map<string, number> | null
): StoreProductCard[] {
  // Every sort is stable over the incoming order, so ties keep relevance.
  const copy = [...items];
  switch (sort) {
    case "best":
      return copy.sort((a, b) => b.soldCount - a.soldCount);
    case "rating":
      return copy.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    case "newest":
      return copy.sort((a, b) => (newest?.get(a.id) ?? 1e9) - (newest?.get(b.id) ?? 1e9));
    case "price_asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price_desc":
      return copy.sort((a, b) => b.price - a.price);
    case "discount":
      return copy.sort((a, b) => b.discountPercent - a.discountPercent);
    default:
      return copy;
  }
}
