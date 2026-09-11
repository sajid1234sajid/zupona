"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Tag, Heart, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  /** Extra routes that should light this tab up, for pages reached from it. */
  alsoMatches?: string[];
  /** Draws the unread dot; Offers always has something running. */
  badge?: boolean;
}

const navItems: NavItem[] = [
  // A product page is reached from browsing, and the reference keeps Home lit
  // while you are on one -- otherwise the bar shows no current tab at all,
  // which reads as broken rather than as neutral.
  { label: "Home", icon: Home, href: "/", alsoMatches: ["/product/", "/products/", "/search"] },
  // A category listing is reached from the browser, so both light up the tab.
  { label: "Categories", icon: LayoutGrid, href: "/categories", alsoMatches: ["/category"] },
  { label: "Offers", icon: Tag, href: "/offers", badge: true },
  { label: "Wishlist", icon: Heart, href: "/wishlist" },
  { label: "Account", icon: User, href: "/account" },
];

/** The five-tab bar, pinned to the bottom of the viewport on every page.
 *
 * It sits above the page content on its own stacking layer; the pages leave
 * bottom padding equal to its height so the last card is never hidden behind
 * it. The extra padding under the labels is the iOS home-indicator inset,
 * which is zero on devices that do not have one. */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-stretch border-t border-brand-tint bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,60,40,0.07)]"
    >
      {navItems.map(({ label, icon: Icon, href, alsoMatches, badge }) => {
        const matchesExtra = alsoMatches?.some((prefix) => pathname.startsWith(prefix)) ?? false;
        const isActive =
          href === "/" ? pathname === "/" || matchesExtra : pathname.startsWith(href) || matchesExtra;

        return (
          <Link
            key={label}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5"
          >
            <span className="relative">
              <Icon
                className={`h-[21px] w-[21px] ${isActive ? "text-brand" : "text-ink-soft"}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {badge && (
                <span
                  aria-hidden
                  className="absolute -right-1.5 -top-1 h-[9px] w-[9px] rounded-full border-2 border-white bg-brand-light"
                />
              )}
            </span>
            <span
              className={`text-[11px] leading-none ${
                isActive ? "font-bold text-brand" : "font-medium text-ink-soft"
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
