"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight, LayoutGrid } from "lucide-react";
import type { NavCategory } from "@/lib/categoryService";

/** The desktop category bar and its mega menu.
 *
 * Zupona's storefront is a 448px mobile design -- every page is a centred
 * `max-w-md` column -- so this bar is the one piece that deliberately breaks
 * out of it, using the full-bleed `w-screen` trick to span the viewport from
 * inside that column. Below `lg` it is not rendered at all and the mobile
 * drill-down at /categories is the navigation; there is no attempt to squeeze
 * a hover menu onto a phone.
 *
 * The panel shows one department at a time: its sections as column headings
 * with their types listed beneath, capped so the panel stays a menu rather
 * than a sitemap. Anything trimmed is one click away behind "View all".
 *
 * Opening is hover *or* focus, and closing is a short timeout rather than an
 * immediate `onMouseLeave`: the pointer has to cross a gap between the tab and
 * the panel, and a menu that vanishes mid-travel cannot be used. Escape closes
 * it, and Tab moving focus out of the menu closes it too, so a keyboard user is
 * never left with an invisible open panel.
 */

/** Sections per department, and types per section. Past this the panel stops
 * being scannable; the rest live on the department's own page. */
const MAX_SECTIONS = 6;
const MAX_TYPES = 5;

const CLOSE_DELAY_MS = 160;

export default function CategoryMegaMenu({ categories }: { categories: NavCategory[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  if (categories.length === 0) return null;

  const open = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenId(id);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenId(null), CLOSE_DELAY_MS);
  };

  const active = categories.find((category) => category.id === openId) ?? null;

  return (
    <div
      ref={rootRef}
      // Full-bleed out of the max-w-md shell: 100vw wide, pulled back to the
      // left edge of the viewport. `sticky` keeps it in flow so it never
      // overlaps the page below it.
      // Full-bleed out of the max-w-md shell by negative margin rather than by
      // `left-1/2` + a transform: `left` on a sticky element is a stickiness
      // constraint, not an offset, so the transform version drifts half a
      // viewport left the moment this stops being `relative`.
      className="sticky top-0 z-50 ml-[calc(50%-50vw)] hidden w-screen border-b border-white/10 bg-brand-darkest text-white lg:block"
      onMouseLeave={scheduleClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpenId(null);
      }}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpenId(null);
      }}
    >
      <div className="mx-auto flex max-w-7xl items-stretch gap-1 px-6">
        <Link
          href="/categories"
          className="flex items-center gap-2 whitespace-nowrap border-r border-white/10 py-2.5 pr-5 text-[13px] font-semibold hover:text-brand-tint"
        >
          <LayoutGrid className="h-4 w-4" strokeWidth={2.25} />
          All Categories
        </Link>

        <nav aria-label="Categories" className="flex items-stretch">
          {categories.map((category) => {
            const isOpen = category.id === openId;
            return (
              <div key={category.id} className="flex items-stretch">
                <Link
                  href={category.href}
                  aria-expanded={category.children.length > 0 ? isOpen : undefined}
                  aria-haspopup={category.children.length > 0 ? "true" : undefined}
                  onMouseEnter={() => open(category.id)}
                  onFocus={() => open(category.id)}
                  className={`flex items-center gap-1 whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors ${
                    isOpen ? "bg-brand-dark text-white" : "text-white/85 hover:text-white"
                  }`}
                >
                  {category.name}
                  {category.children.length > 0 && (
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      strokeWidth={2.5}
                    />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>
      </div>

      {active && active.children.length > 0 && (
        <div
          // Absolute rather than in flow: the panel must not push the page down
          // when it opens, or every hover would reflow the whole storefront.
          className="absolute inset-x-0 top-full border-t border-black/5 bg-white text-ink shadow-[0_16px_40px_rgba(0,60,40,0.16)]"
          onMouseEnter={() => open(active.id)}
        >
          <div className="mx-auto flex max-w-7xl gap-8 px-6 py-6">
            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6 xl:grid-cols-3">
                {active.children.slice(0, MAX_SECTIONS).map((section) => (
                  <div key={section.id} className="min-w-0">
                    <Link
                      href={section.href}
                      className="block truncate text-[13px] font-bold text-ink hover:text-brand"
                    >
                      {section.name}
                    </Link>

                    {section.children.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {section.children.slice(0, MAX_TYPES).map((type) => (
                          <li key={type.id}>
                            <Link
                              href={type.href}
                              className="block truncate text-[12.5px] text-ink-muted transition-colors hover:text-brand"
                            >
                              {type.name}
                            </Link>
                          </li>
                        ))}
                        {section.children.length > MAX_TYPES && (
                          <li>
                            <Link
                              href={section.href}
                              className="text-[12px] font-semibold text-brand hover:underline"
                            >
                              +{section.children.length - MAX_TYPES} more
                            </Link>
                          </li>
                        )}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[12px] text-ink-muted/70">
                        {section.productCount} {section.productCount === 1 ? "item" : "items"}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <Link
                href={active.href}
                className="mt-6 inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
              >
                View all {active.name}
                <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
              </Link>
            </div>

            {active.imageUrl && (
              <Link
                href={active.href}
                className="hidden w-56 shrink-0 overflow-hidden rounded-2xl bg-brand-mist xl:block"
              >
                <span className="relative block aspect-[4/3] w-full">
                  <Image
                    src={active.imageUrl}
                    alt=""
                    fill
                    sizes="224px"
                    // Uploaded media is served from /api/media/, which the Next
                    // image optimizer cannot fetch -- it answers 404 and the
                    // tile renders broken. See AGENTS.md.
                    unoptimized={active.imageUrl.startsWith("/api/media/")}
                    className="object-cover"
                  />
                </span>
                <span className="block px-4 py-3">
                  <span className="block text-[13px] font-bold text-ink">{active.name}</span>
                  <span className="block text-[11.5px] text-ink-muted">
                    {active.subtitle ?? `${active.productCount} products`}
                  </span>
                </span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
