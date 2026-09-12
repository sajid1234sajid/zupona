"use client";

import { createElement, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Flame, Sparkles, Star, Tag } from "lucide-react";
import type { NavCategory } from "@/lib/categoryService";
import { useProductSearch } from "@/components/search/SearchProvider";
import { resolveCategoryIcon } from "./categoryIcons";
import { formatPrice } from "@/lib/format";

/** The category index: a two-pane browser on a phone, a full map on a desktop.
 *
 * Mobile is the rail-and-pane shape Daraz and Alibaba both use, and the one
 * that survives a 448px screen: the rail keeps the shopper's place in the
 * taxonomy on screen while the right pane changes, so moving between
 * departments costs no navigation and no back button. A drill-down would hide
 * that context the moment a department opened.
 *
 * Switching panes is local state, not a route change -- the whole tree is
 * already on the client, so a round trip would only add latency. Committing to
 * a category (a tile, "View all") is a real navigation to its slug path, which
 * is where filtering and sorting live.
 *
 * Three panes are not departments: "For You", "Featured" and "Deals" are views
 * over the same tree rather than rows in it, which is why they are defined here
 * and not in the database.
 */

export interface BrowseCategory extends NavCategory {
  /** Cheapest active product anywhere in the department. */
  fromPrice: number | null;
  bestDiscount: number;
  highlights: { id: string; name: string; image: string; price: number; discountPercent: number }[];
}

/** Rail entries that are views rather than categories. */
type ShortcutId = "for-you" | "featured" | "deals";

const SHORTCUTS: { id: ShortcutId; label: string; icon: typeof Star }[] = [
  { id: "for-you", label: "For You", icon: Sparkles },
  { id: "featured", label: "Featured", icon: Star },
  { id: "deals", label: "Deals", icon: Tag },
];

interface Tile {
  key: string;
  name: string;
  href: string;
  image: string | null;
  icon: string | null;
  count: number;
}

function toTile(node: NavCategory, href = node.href): Tile {
  return {
    key: node.id,
    name: node.name,
    href,
    image: node.imageUrl ?? node.iconUrl,
    icon: node.icon ?? null,
    count: node.productCount,
  };
}

function descendants(node: NavCategory): NavCategory[] {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

export default function CategoryBrowser({
  categories,
  featuredIds,
}: {
  categories: BrowseCategory[];
  /** Ids the admin has ticked "Featured", at any level. */
  featuredIds: string[];
}) {
  const [activeId, setActiveId] = useState<string>(categories[0] ? "for-you" : "for-you");

  // The header's search box is the category search on this page; the text
  // itself lives in SearchProvider so the box stays a presentational component.
  const { query } = useProductSearch();
  const term = query.trim().toLowerCase();

  const everything = useMemo(
    () =>
      categories.flatMap((department) =>
        [department, ...descendants(department)].map((node) => ({
          node,
          department: department.name,
        }))
      ),
    [categories]
  );

  const results = useMemo(() => {
    if (term.length === 0) return null;
    return everything
      .filter(
        ({ node }) =>
          node.name.toLowerCase().includes(term) ||
          (node.nameBn ?? "").toLowerCase().includes(term)
      )
      .slice(0, 60);
  }, [everything, term]);

  const featured = useMemo(() => new Set(featuredIds), [featuredIds]);
  const activeDepartment = categories.find((category) => category.id === activeId) ?? null;

  if (categories.length === 0) {
    return (
      <p className="px-4 py-16 text-center text-sm text-neutral-400">
        No categories have been published yet.
      </p>
    );
  }

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Phone: rail + pane                                               */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex min-h-0 flex-1 lg:hidden">
        <nav
          aria-label="Categories"
          className="w-[116px] shrink-0 overflow-y-auto border-r border-brand-tint bg-brand-mist pb-24 no-scrollbar"
        >
          {SHORTCUTS.map((shortcut) => (
            <RailItem
              key={shortcut.id}
              label={shortcut.label}
              Icon={shortcut.icon}
              active={activeId === shortcut.id}
              onClick={() => setActiveId(shortcut.id)}
            />
          ))}

          <span className="mx-3 my-1 block h-px bg-brand-tint" aria-hidden />

          {categories.map((category) => (
            <RailItem
              key={category.id}
              label={category.name}
              Icon={resolveCategoryIcon(category.icon ?? null, category.name)}
              image={category.iconUrl}
              active={activeId === category.id}
              onClick={() => setActiveId(category.id)}
            />
          ))}
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto bg-white px-3.5 pb-24 pt-3 no-scrollbar">
          {results ? (
            <Pane title={`“${query.trim()}”`}>
              {results.length === 0 ? (
                <p className="py-14 text-center text-sm text-neutral-400">
                  No category matches that. Try a shorter word.
                </p>
              ) : (
                <TileGrid
                  tiles={results.map(({ node }) => toTile(node))}
                  captions={results.map(({ node, department }) =>
                    node.depth === 1 ? "Department" : department
                  )}
                />
              )}
            </Pane>
          ) : activeId === "for-you" ? (
            <ForYouPane categories={categories} />
          ) : activeId === "featured" ? (
            <ShortcutPane
              title="Featured"
              blurb="Hand-picked in the admin panel"
              tiles={everything
                .filter(({ node }) => featured.has(node.id))
                .map(({ node }) => toTile(node))}
              empty="Nothing is flagged as featured yet."
            />
          ) : activeId === "deals" ? (
            <ShortcutPane
              title="Deals"
              blurb="Departments running a discount right now"
              tiles={categories
                .filter((category) => category.bestDiscount > 0)
                .map((category) => ({
                  ...toTile(category, `${category.href}?sort=discount`),
                  name: `${category.name} · up to ${category.bestDiscount}%`,
                }))}
              empty="No discounts are running at the moment."
            />
          ) : activeDepartment ? (
            <DepartmentPane category={activeDepartment} onBack={() => setActiveId("for-you")} />
          ) : null}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Desktop: the whole map at once — there is room for it, and        */}
      {/* scanning beats clicking when nothing has to be hidden.            */}
      {/* ---------------------------------------------------------------- */}
      <div className="hidden px-8 pb-12 pt-6 lg:block">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-ink">All Categories</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {categories.length} {categories.length === 1 ? "department" : "departments"} ·{" "}
            {categories.reduce((sum, category) => sum + category.productCount, 0)} products
          </p>
        </div>

        {results ? (
          <>
            <h2 className="mb-4 text-lg font-bold text-ink">Matching “{query.trim()}”</h2>
            {results.length === 0 ? (
              <p className="py-10 text-sm text-neutral-400">
                No category matches that. Try a shorter word.
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-3">
                {results.map(({ node, department }) => (
                  <li key={node.id}>
                    <Link
                      href={node.href}
                      className="flex items-center gap-3 rounded-xl border border-neutral-100 px-3 py-2.5 transition hover:border-brand"
                    >
                      <TileArt
                        image={node.imageUrl ?? node.iconUrl}
                        icon={node.icon ?? null}
                        name={node.name}
                        size="sm"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-ink">
                          {node.name}
                        </span>
                        <span className="block truncate text-[11px] text-ink-muted">
                          {node.depth === 1 ? "Department" : department} · {node.productCount}{" "}
                          {node.productCount === 1 ? "item" : "items"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <DepartmentColumn key={category.id} category={category} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Rail                                                                       */
/* -------------------------------------------------------------------------- */

function RailItem({
  label,
  Icon,
  image,
  active,
  onClick,
}: {
  label: string;
  Icon: ReturnType<typeof resolveCategoryIcon>;
  image?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`relative flex w-full items-center gap-2 px-2.5 py-3 text-left transition-colors ${
        active ? "bg-brand-tint" : "hover:bg-brand-tint/50"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r bg-brand" aria-hidden />
      )}

      {image ? (
        <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded">
          <Image
            src={image}
            alt=""
            fill
            sizes="20px"
            unoptimized={image.startsWith("/api/media/")}
            className="object-cover"
          />
        </span>
      ) : (
        <Icon
          className={`h-[18px] w-[18px] shrink-0 ${active ? "text-brand" : "text-ink-muted"}`}
          strokeWidth={active ? 2.4 : 2}
          aria-hidden
        />
      )}

      <span
        className={`min-w-0 flex-1 text-[10.5px] leading-tight ${
          active ? "font-bold text-brand" : "font-medium text-ink"
        }`}
      >
        {label}
      </span>

      {active && (
        <ChevronRight className="h-3 w-3 shrink-0 text-brand" strokeWidth={3} aria-hidden />
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Panes                                                                      */
/* -------------------------------------------------------------------------- */

function Pane({
  title,
  onBack,
  action,
  children,
}: {
  title: string;
  onBack?: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to all categories"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-brand-tint"
          >
            <ChevronLeft className="h-4.5 w-4.5" strokeWidth={2.5} />
          </button>
        )}
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </>
  );
}

function DepartmentPane({
  category,
  onBack,
}: {
  category: BrowseCategory;
  onBack: () => void;
}) {
  const tiles = category.children.map((child) => toTile(child));

  return (
    <Pane
      title={category.name}
      onBack={onBack}
      action={
        <Link
          href={category.href}
          className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-brand"
        >
          View all
          <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
        </Link>
      }
    >
      <DepartmentBanner category={category} />

      {tiles.length > 0 ? (
        <>
          <h3 className="mt-4 text-[15px] font-bold text-ink">Recommendations</h3>
          <TileGrid tiles={tiles} />
        </>
      ) : (
        <p className="mt-4 text-[12px] text-ink-muted">
          No subcategories yet — {category.productCount}{" "}
          {category.productCount === 1 ? "product is" : "products are"} filed directly under{" "}
          {category.name}.
        </p>
      )}

      {category.highlights.length > 0 && (
        <>
          <h3 className="mt-5 text-[13px] font-bold text-ink">Popular in {category.name}</h3>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {category.highlights.map((product) => (
              <Link key={product.id} href={`/product/${product.id}`} className="w-[88px] shrink-0">
                <span className="relative block h-[88px] w-full overflow-hidden rounded-xl bg-brand-mist">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="88px"
                    unoptimized={product.image.startsWith("/api/media/")}
                    className="object-cover"
                  />
                  {product.discountPercent > 0 && (
                    <span className="absolute left-1 top-1 rounded bg-accent-red px-1 text-[8px] font-bold text-white">
                      -{product.discountPercent}%
                    </span>
                  )}
                </span>
                <span className="mt-1 block truncate text-[10px] font-medium text-ink">
                  {product.name}
                </span>
                <span className="block text-[10.5px] font-bold text-ink">
                  {formatPrice(product.price)}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </Pane>
  );
}

/** The department's own promo card.
 *
 * Every word of it is a database column -- the headline is the category's
 * description, the line under it its tagline, the artwork its image -- so a
 * department added in the admin panel gets a banner without anyone writing one.
 * A department with neither description nor tagline still reads sensibly
 * because the fallbacks are built from its name and product count. */
function DepartmentBanner({ category }: { category: BrowseCategory }) {
  const headline = category.subtitle ?? `Everything in ${category.name}`;
  const blurb =
    category.nameBn ??
    `${category.productCount} ${category.productCount === 1 ? "product" : "products"}${
      category.fromPrice !== null ? ` · from ${formatPrice(category.fromPrice)}` : ""
    }`;

  return (
    <Link
      href={category.href}
      className="relative mt-2.5 flex items-center gap-2 overflow-hidden rounded-2xl bg-brand-tint px-3.5 py-3"
    >
      <span className="relative z-10 min-w-0 flex-1">
        <span className="block text-[13px] font-extrabold leading-snug text-brand-darkest">
          {headline}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-ink-muted">{blurb}</span>
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-[10.5px] font-semibold text-white">
          Explore Now
          <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
        </span>
      </span>

      {category.imageUrl ? (
        <span className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-xl">
          <Image
            src={category.imageUrl}
            alt=""
            fill
            sizes="74px"
            unoptimized={category.imageUrl.startsWith("/api/media/")}
            className="object-cover"
          />
        </span>
      ) : (
        <span className="grid h-[74px] w-[74px] shrink-0 place-items-center rounded-xl bg-white/70" aria-hidden>
          <Flame className="h-7 w-7 text-brand" strokeWidth={1.75} />
        </span>
      )}
    </Link>
  );
}

function ForYouPane({ categories }: { categories: BrowseCategory[] }) {
  // One tile per department's busiest section, so the opening pane is a cross
  // section of the shop rather than a repeat of the rail beside it.
  const picks = categories
    .map((department) => {
      const best = [...department.children].sort((a, b) => b.productCount - a.productCount)[0];
      return best ? toTile(best) : toTile(department);
    })
    .filter(Boolean);

  return (
    <Pane title="For You">
      <p className="mt-0.5 text-[10.5px] text-ink-muted">Popular across every department</p>
      <TileGrid tiles={picks} />

      <h3 className="mt-5 text-[15px] font-bold text-ink">All Departments</h3>
      <TileGrid tiles={categories.map((category) => toTile(category))} />
    </Pane>
  );
}

function ShortcutPane({
  title,
  blurb,
  tiles,
  empty,
}: {
  title: string;
  blurb: string;
  tiles: Tile[];
  empty: string;
}) {
  return (
    <Pane title={title}>
      <p className="mt-0.5 text-[10.5px] text-ink-muted">{blurb}</p>
      {tiles.length === 0 ? (
        <p className="py-14 text-center text-sm text-neutral-400">{empty}</p>
      ) : (
        <TileGrid tiles={tiles} />
      )}
    </Pane>
  );
}

/* -------------------------------------------------------------------------- */
/* Tiles                                                                      */
/* -------------------------------------------------------------------------- */

function TileGrid({ tiles, captions }: { tiles: Tile[]; captions?: string[] }) {
  return (
    <div className="mt-2.5 grid grid-cols-3 gap-x-2 gap-y-3.5">
      {tiles.map((tile, index) => (
        <Link key={tile.key} href={tile.href} className="group flex min-w-0 flex-col items-center">
          <TileArt image={tile.image} icon={tile.icon} name={tile.name} size="md" />
          <span className="mt-1.5 flex w-full items-center gap-0.5">
            <span className="min-w-0 flex-1 text-[10.5px] font-medium leading-tight text-ink">
              {tile.name}
              {captions?.[index] ? (
                <span className="mt-0.5 block truncate text-[9px] text-ink-muted">
                  {captions[index]}
                </span>
              ) : null}
            </span>
            <span
              aria-hidden
              className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-brand-tint text-brand transition-colors group-hover:bg-brand group-hover:text-white"
            >
              <ChevronRight className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** A tile's picture: the uploaded artwork when there is one, the category's
 * icon when there is not. Never an empty box -- a missing upload must not leave
 * a hole in the grid. */
function TileArt({
  image,
  icon,
  name,
  size,
}: {
  image: string | null;
  icon: string | null;
  name: string;
  size: "sm" | "md";
}) {
  const box = size === "sm" ? "h-10 w-10" : "aspect-square w-full";

  if (!image) {
    return (
      <span
        className={`${box} grid shrink-0 place-items-center rounded-full bg-brand-tint`}
        aria-hidden
      >
        {/* `createElement` rather than assigning the looked-up component to a
            capitalised const: the lint rule reads that as declaring a component
            during render, which this is not -- the map in categoryIcons.ts
            holds the same stable references for the life of the module. */}
        {createElement(resolveCategoryIcon(icon, name), {
          className: size === "sm" ? "h-4 w-4" : "h-7 w-7",
          strokeWidth: 1.9,
        })}
      </span>
    );
  }

  return (
    <span className={`relative ${box} shrink-0 overflow-hidden rounded-full bg-brand-mist`}>
      <Image
        src={image}
        alt=""
        fill
        sizes="(min-width: 1024px) 40px, 96px"
        // Uploaded artwork is served from /api/media/, which the Next image
        // optimizer cannot fetch -- it answers 404. See AGENTS.md.
        unoptimized={image.startsWith("/api/media/")}
        className="object-cover"
      />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Desktop column                                                             */
/* -------------------------------------------------------------------------- */

function DepartmentColumn({ category }: { category: BrowseCategory }) {
  return (
    <section className="min-w-0">
      <div className="flex items-center gap-3">
        <TileArt
          image={category.imageUrl ?? category.iconUrl}
          icon={category.icon ?? null}
          name={category.name}
          size="sm"
        />
        <div className="min-w-0">
          <Link href={category.href} className="block truncate text-sm font-bold text-ink hover:text-brand">
            {category.name}
          </Link>
          <p className="truncate text-xs text-ink-muted">
            {category.productCount} {category.productCount === 1 ? "item" : "items"}
            {category.fromPrice !== null && ` · from ${formatPrice(category.fromPrice)}`}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2 border-l border-neutral-100 pl-4">
        {category.children.map((section) => (
          <li key={section.id} className="min-w-0">
            <Link href={section.href} className="block truncate text-[13px] font-semibold text-ink hover:text-brand">
              {section.name}
            </Link>
            {section.children.length > 0 && (
              <p className="mt-0.5 truncate text-xs text-ink-muted">
                {section.children.map((type, index) => (
                  <span key={type.id}>
                    {index > 0 && " · "}
                    <Link href={type.href} className="hover:text-brand hover:underline">
                      {type.name}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
        {category.children.length === 0 && (
          <li className="text-xs text-ink-muted">No subcategories yet.</li>
        )}
      </ul>
    </section>
  );
}
