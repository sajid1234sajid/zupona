import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { listStoreCategories } from "@/lib/storefront";

/** The eight departments, straight from the catalog.
 *
 * Names, subtitles and artwork are all database columns, so a department
 * renamed in the admin panel changes here without a deploy. Each tile links to
 * `/category/<id>` by that stable id -- never by matching on the product or
 * category name -- which is what keeps a renamed department's links working
 * and stops a product ever surfacing under the wrong heading. */
export default async function CategoryGrid() {
  const categories = await listStoreCategories();

  return (
    <section className="grid grid-cols-2 gap-1.5 px-3.5 pt-2.5">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/category/${category.id}`}
          className="flex items-center gap-2 rounded-xl border border-brand-tint bg-brand-mist p-1.5"
        >
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
            <span className="block truncate text-[9.5px] font-bold leading-tight text-ink">
              {category.name}
            </span>
            <span className="block truncate text-[7px] leading-tight text-ink-muted">
              {category.subtitle}
            </span>
          </span>

          <span
            aria-hidden
            className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-brand text-white"
          >
            <ChevronRight className="h-[11px] w-[11px]" strokeWidth={3} />
          </span>
        </Link>
      ))}
    </section>
  );
}
