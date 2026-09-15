import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react";
import type { StoreCategory } from "@/lib/storefront";

/** The departments shown up top, in the order they appear.
 *
 * Presentation rather than catalog, like the filter chips: these are stable
 * ids, so names, subtitles and artwork still come from the database. A
 * department hidden in the admin panel simply drops out of the row instead of
 * leaving a tile that 404s. */
const FEATURED_CATEGORY_IDS = [
  "mens-fashion",
  "womens-fashion",
  "baby-products",
  "electronics",
  "health-beauty",
];

/** The full department list further down the home page, which "More" scrolls
 * to. The page-scoped smooth scrolling in `globals.css` keys off this id. */
const ALL_CATEGORIES_ID = "all-categories";

const cardClass =
  "flex items-center gap-2 rounded-xl border border-brand-tint bg-brand-mist p-1.5";

const titleClass =
  "block text-[11px] font-bold leading-tight text-heading [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden";

const subtitleClass =
  "mt-0.5 block text-[10px] leading-tight text-ink-slate [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden";

const arrowClass =
  "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-brand text-white";

/** One department tile. Each links to `/category/<id>` by that stable id --
 * never by matching on the product or category name -- which is what keeps a
 * renamed department's links working and stops a product ever surfacing under
 * the wrong heading. */
function CategoryCard({ category }: { category: StoreCategory }) {
  return (
    <Link href={`/category/${category.id}`} className={cardClass}>
      <span className="relative h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[10px] bg-white">
        <Image
          src={category.image}
          alt=""
          fill
          sizes="34px"
          className="object-cover"
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className={titleClass}>{category.name}</span>
        <span className={subtitleClass}>{category.subtitle}</span>
      </span>

      <span aria-hidden className={arrowClass}>
        <ChevronRight className="h-[11px] w-[11px]" strokeWidth={3} />
      </span>
    </Link>
  );
}

/** Five featured departments and a "More" tile.
 *
 * "More" is a plain fragment link to the full list on this same page, not a
 * route: the browser scrolls natively, so it costs no JavaScript and no
 * navigation. Its arrow points down to say it stays on the page. */
export default function CategoryGrid({ categories }: { categories: StoreCategory[] }) {
  const featured = FEATURED_CATEGORY_IDS.map((id) =>
    categories.find((category) => category.id === id)
  ).filter((category): category is StoreCategory => category !== undefined);

  return (
    // auto-rows-fr: a subtitle that wraps would otherwise make only its own row
    // taller, leaving the tiles at two or three different heights.
    <section className="grid auto-rows-fr grid-cols-2 gap-1.5 px-3.5 pt-2.5">
      {featured.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}

      <a href={`#${ALL_CATEGORIES_ID}`} className={cardClass}>
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-white text-brand">
          <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </span>

        <span className="min-w-0 flex-1">
          <span className={titleClass}>More</span>
          <span className={subtitleClass}>All {categories.length} categories</span>
        </span>

        <span aria-hidden className={arrowClass}>
          <ChevronDown className="h-[11px] w-[11px]" strokeWidth={3} />
        </span>
      </a>
    </section>
  );
}

/** Every department, in catalog order -- the target of the "More" tile.
 *
 * The scroll margin clears the folded sticky header (`COLLAPSED_HEIGHT` in
 * `StickyHeader`, 54px, plus a little air), so the heading lands just below
 * the bar rather than underneath it. The bottom padding keeps the last row
 * clear of the tab bar's raised cart button. */
export function AllCategories({ categories }: { categories: StoreCategory[] }) {
  return (
    <section
      id={ALL_CATEGORIES_ID}
      aria-labelledby={`${ALL_CATEGORIES_ID}-heading`}
      className="scroll-mt-[62px] px-3.5 pb-6 pt-4"
    >
      <h2
        id={`${ALL_CATEGORIES_ID}-heading`}
        className="flex items-center gap-1 text-[11px] font-bold text-ink"
      >
        <LayoutGrid className="h-3 w-3 text-brand" strokeWidth={2.5} />
        All Categories
      </h2>

      <div className="mt-2 grid auto-rows-fr grid-cols-2 gap-1.5">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </section>
  );
}
