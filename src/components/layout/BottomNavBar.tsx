"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, ShoppingCart, Tag, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  /** Extra routes that should light this tab up, for pages reached from it. */
  alsoMatches?: string[];
  /** Draws the unread dot; Offers always has something running. */
  badge?: boolean;
  /** The raised centre button. Exactly one tab may claim it. */
  raised?: boolean;
}

const navItems: NavItem[] = [
  // A product page is reached from browsing, and the reference keeps Home lit
  // while you are on one -- otherwise the bar shows no current tab at all,
  // which reads as broken rather than as neutral.
  { label: "Home", icon: Home, href: "/", alsoMatches: ["/product/", "/products/", "/search"] },
  // A category listing is reached from the browser, so both light up the tab.
  { label: "Categories", icon: LayoutGrid, href: "/categories", alsoMatches: ["/category"] },
  // The middle slot, raised: the cart is the tab a shopper hunts for, and it
  // is the one that finishes a sale. The wishlist gave up its tab for it and
  // now lives in the header instead.
  { label: "Cart", icon: ShoppingCart, href: "/cart", raised: true },
  { label: "Offers", icon: Tag, href: "/offers", badge: true },
  { label: "Account", icon: User, href: "/account" },
];

/** The five-tab bar, pinned to the bottom of the viewport on every page.
 *
 * It sits above the page content on its own stacking layer; the pages leave
 * bottom padding equal to its height so the last card is never hidden behind
 * it. The extra padding under the labels is the iOS home-indicator inset,
 * which is zero on devices that do not have one.
 *
 * Labels are 11px on 21px icons, measured off the reference; the 7.5px they
 * replaced was the clearest legibility miss on the screen.
 *
 * Phones only: from the `tab` breakpoint up, `DesktopHeader` carries the same
 * destinations and this bar is hidden.
 *
 * The markup lives here rather than in `BottomNav` because the active tab is
 * decided from the browser's path; the count arrives as a prop so the badge
 * is right on first paint instead of appearing a moment after hydration. */
export default function BottomNavBar({ cartCount }: { cartCount: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-stretch border-t border-brand-tint bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,60,40,0.07)] tab:hidden"
    >
      {navItems.map(({ label, icon: Icon, href, alsoMatches, badge, raised }) => {
        const matchesExtra = alsoMatches?.some((prefix) => pathname.startsWith(prefix)) ?? false;
        const isActive =
          href === "/" ? pathname === "/" || matchesExtra : pathname.startsWith(href) || matchesExtra;

        return (
          <Link
            key={label}
            href={href}
            aria-current={isActive ? "page" : undefined}
            aria-label={
              raised && cartCount > 0
                ? `${label}, ${cartCount} ${cartCount === 1 ? "item" : "items"}`
                : undefined
            }
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5"
          >
            {/* Both shapes sit in the same 21px box, so the raised button
                changes nothing about the bar's height or where the labels
                line up -- it only floats out of it. */}
            <span className="relative h-[21px] w-[21px]">
              {raised ? (
                <span
                  className={`absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-[90%] place-items-center rounded-full text-white ring-4 ring-white transition-colors duration-150 motion-reduce:transition-none ${
                    isActive
                      ? "bg-brand-darkest shadow-[0_8px_18px_-6px_rgba(0,85,61,0.85)]"
                      : "bg-brand shadow-[0_8px_18px_-6px_rgba(0,132,95,0.75)]"
                  }`}
                >
                  <Icon className="h-[22px] w-[22px]" strokeWidth={2.25} />
                  {cartCount > 0 && (
                    // Outside the circle's edge, so it reads as a count on
                    // the button rather than as part of the icon.
                    <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-red px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </span>
              ) : (
                <Icon
                  className={`h-[21px] w-[21px] ${isActive ? "text-brand" : "text-ink-soft"}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              )}
              {badge && (
                <span
                  aria-hidden
                  className="absolute -right-1.5 -top-1 h-[9px] w-[9px] rounded-full border-2 border-white bg-brand-light"
                />
              )}
            </span>
            <span
              className={`text-[11px] leading-none ${
                isActive || raised ? "font-bold text-brand" : "font-medium text-ink-soft"
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
