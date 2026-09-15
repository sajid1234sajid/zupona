import Image from "next/image";
import Link from "next/link";
import { ChevronRight, LayoutGrid } from "lucide-react";
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

const cardClass =
  "flex items-center gap-2 rounded-xl border border-brand-tint bg-brand-mist p-1.5";

const titleClass =
  "block text-[11px] font-bold leading-tight text-heading [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden";

const subtitleClass =
  "mt-0.5 block text-[10px] leading-tight text-ink-slate [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden";

const arrowClass =
  "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-brand text-white";

/** Five featured departments and a "More" tile.
 *
 * Each department tile links to `/category/<id>` by that stable id -- never by
 * matching on the product or category name -- which is what keeps a renamed
 * department's links working. "More" opens the full category browser at
 * `/categories`, the same page the tab bar's Categories tab goes to. */
export default function CategoryGrid({ categories }: { categories: StoreCategory[] }) {
  const featured = FEATURED_CATEGORY_IDS.map((id) =>
    categories.find((category) => category.id === id)
  ).filter((category): category is StoreCategory => category !== undefined);

  return (
    // auto-rows-fr: a subtitle that wraps would otherwise make only its own row
    // taller, leaving the tiles at two or three different heights.
    <section className="grid auto-rows-fr grid-cols-2 gap-1.5 px-3.5 pt-2.5">
      {featured.map((category) => (
        <Link key={category.id} href={`/category/${category.id}`} className={cardClass}>
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
      ))}

      <Link href="/categories" className={cardClass}>
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-white text-brand">
          <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </span>

        <span className="min-w-0 flex-1">
          <span className={titleClass}>More</span>
          <span className={subtitleClass}>All {categories.length} categories</span>
        </span>

        <span aria-hidden className={arrowClass}>
          <ChevronRight className="h-[11px] w-[11px]" strokeWidth={3} />
        </span>
      </Link>
    </section>
  );
}
