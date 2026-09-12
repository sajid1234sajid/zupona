import Image from "next/image";
import Link from "next/link";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { countHomepageCategories, getHomepageCategories } from "@/lib/categoryService";

/** The homepage's category section.
 *
 * Which categories appear, and in what order, is data: a department shows here
 * when its "Show on homepage" box is ticked, so curating the front page is an
 * admin action rather than a deploy. Names, taglines and artwork are columns
 * too, which is why nothing here is hardcoded.
 *
 * Links use the category's slug path (`/category/electronics`), never its id --
 * an id is a UUID for anything created in the admin panel, and a UUID in a
 * shopper-facing URL is both ugly and useless to search engines.
 *
 * Two layouts, one component. On a phone it is the compact two-up rail the rest
 * of the mobile design is built around; from `sm` up it becomes a grid of
 * rounded tiles with room for the product count. The tile count is capped so
 * the section stays a shortcut rather than a full index -- "View all" carries
 * the rest.
 */

/** As many as fit above the fold without the section turning into the
 * categories page. */
const MAX_TILES = 8;

export default async function CategoryGrid() {
  const [categories, total] = await Promise.all([
    getHomepageCategories(MAX_TILES),
    countHomepageCategories(),
  ]);

  if (categories.length === 0) return null;

  const hidden = Math.max(0, total - categories.length);

  return (
    <section aria-labelledby="home-categories" className="px-3.5 pt-2.5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="home-categories" className="text-[13px] font-bold text-ink sm:text-base">
          Shop by Category
        </h2>
        <Link
          href="/categories"
          className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-brand sm:text-xs"
        >
          View All
          {hidden > 0 && <span className="text-ink-muted">({hidden} more)</span>}
          <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2.5} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-3">
        {categories.map((category) => {
          const image = category.iconUrl ?? category.imageUrl;

          return (
            <Link
              key={category.id}
              href={category.href}
              // `min-w-0` on the text column is what keeps a long Bangla or
              // English name from widening the tile and pushing the grid into a
              // horizontal scroll on a narrow phone.
              className="flex items-center gap-2 rounded-xl border border-brand-tint bg-brand-mist p-1.5 transition-colors hover:border-brand hover:bg-brand-tint sm:flex-col sm:gap-2 sm:p-3 sm:text-center"
            >
              <span className="relative h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[10px] bg-white sm:h-16 sm:w-16 sm:rounded-full">
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 64px, 34px"
                    // Uploaded media lives behind /api/media/, which the Next
                    // image optimizer cannot fetch (it answers 404 and the tile
                    // renders broken). See AGENTS.md.
                    unoptimized={image.startsWith("/api/media/")}
                    className="object-cover"
                  />
                ) : (
                  // A department with no artwork gets the brand placeholder
                  // rather than a broken image box, so the row keeps its shape.
                  <span className="flex h-full w-full items-center justify-center bg-brand-tint">
                    <LayoutGrid className="h-4 w-4 text-brand sm:h-6 sm:w-6" strokeWidth={2} />
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1 sm:w-full sm:flex-none">
                <span className="block truncate text-[9.5px] font-bold leading-tight text-ink sm:text-[13px]">
                  {category.name}
                </span>
                <span className="block truncate text-[7px] leading-tight text-ink-muted sm:text-[11px]">
                  {category.subtitle ??
                    `${category.productCount} ${category.productCount === 1 ? "item" : "items"}`}
                </span>
              </span>

              <span
                aria-hidden
                className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-brand text-white sm:hidden"
              >
                <ChevronRight className="h-[11px] w-[11px]" strokeWidth={3} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
