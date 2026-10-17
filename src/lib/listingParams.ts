/** What a product listing is filtered and sorted by, as it appears in the URL.
 *
 * `/search` (and, next, the category pages) keep every filter in the query
 * string -- `?q=shirt&size=M,L&price=500-1000&sort=best` -- so a filtered list
 * is a real address: it survives Back, a refresh and being shared. This
 * module only reads and writes that string; it touches no database, because
 * the filter bar is a client component and needs it too. */

export type ListingSort =
  | "relevance"
  | "best"
  | "rating"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "discount";

export const LISTING_SORTS: { id: ListingSort; label: string }[] = [
  { id: "relevance", label: "Relevance" },
  { id: "best", label: "Best selling" },
  { id: "rating", label: "Top rated" },
  { id: "newest", label: "Newest" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "discount", label: "Biggest discount" },
];

/** The price shortcuts. `max` null is open-ended. */
export const PRICE_PRESETS: { id: string; label: string; min: number; max: number | null }[] = [
  { id: "0-500", label: "Under ৳500", min: 0, max: 500 },
  { id: "500-1000", label: "৳500 – ৳1,000", min: 500, max: 1000 },
  { id: "1000-2000", label: "৳1,000 – ৳2,000", min: 1000, max: 2000 },
  { id: "2000-", label: "৳2,000+", min: 2000, max: null },
];

export interface ListingFilters {
  q: string;
  /** A department or sub-department id. */
  category: string | null;
  price: { min: number; max: number | null } | null;
  sizes: string[];
  colors: string[];
  brands: string[];
  deals: boolean;
  freeDelivery: boolean;
  rating4: boolean;
  sort: ListingSort;
}

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

const list = (value: string | string[] | undefined) =>
  first(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export function parsePrice(raw: string): ListingFilters["price"] {
  const m = raw.match(/^(\d*)-(\d*)$/);
  if (!m || (m[1] === "" && m[2] === "")) return null;
  const min = m[1] === "" ? 0 : Number(m[1]);
  const max = m[2] === "" ? null : Number(m[2]);
  if (max !== null && max < min) return { min: max, max: min };
  return { min, max };
}

export function parseListing(params: Params, defaultSort: ListingSort = "relevance"): ListingFilters {
  const sort = first(params.sort) as ListingSort;
  return {
    q: first(params.q).trim().slice(0, 100),
    category: first(params.category) || null,
    price: parsePrice(first(params.price)),
    sizes: list(params.size),
    colors: list(params.color),
    brands: list(params.brand),
    deals: first(params.deals) === "1",
    freeDelivery: first(params.free) === "1",
    rating4: first(params.rating) === "4",
    sort: LISTING_SORTS.some((option) => option.id === sort) ? sort : defaultSort,
  };
}

/** The query string for `filters`, leaving out everything at its default so
 * the address stays short. */
export function listingQuery(filters: ListingFilters, defaultSort: ListingSort = "relevance"): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.price) params.set("price", `${filters.price.min}-${filters.price.max ?? ""}`);
  if (filters.sizes.length) params.set("size", filters.sizes.join(","));
  if (filters.colors.length) params.set("color", filters.colors.join(","));
  if (filters.brands.length) params.set("brand", filters.brands.join(","));
  if (filters.deals) params.set("deals", "1");
  if (filters.freeDelivery) params.set("free", "1");
  if (filters.rating4) params.set("rating", "4");
  if (filters.sort !== defaultSort) params.set("sort", filters.sort);
  return params.toString();
}

/** True when anything beyond the query and the sort narrows the list. */
export function hasFilters(filters: ListingFilters): boolean {
  return Boolean(
    filters.category ||
      filters.price ||
      filters.sizes.length ||
      filters.colors.length ||
      filters.brands.length ||
      filters.deals ||
      filters.freeDelivery ||
      filters.rating4
  );
}

export function clearFilters(filters: ListingFilters): ListingFilters {
  return {
    ...filters,
    category: null,
    price: null,
    sizes: [],
    colors: [],
    brands: [],
    deals: false,
    freeDelivery: false,
    rating4: false,
  };
}

export function toggleIn(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/** "৳500 – ৳1,000", "৳2,000+". */
export function priceLabel(price: NonNullable<ListingFilters["price"]>): string {
  const taka = (n: number) => `৳${n.toLocaleString("en-US")}`;
  if (price.max === null) return `${taka(price.min)}+`;
  if (price.min === 0) return `Under ${taka(price.max)}`;
  return `${taka(price.min)} – ${taka(price.max)}`;
}
