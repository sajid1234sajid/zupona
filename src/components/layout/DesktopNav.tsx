"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin } from "lucide-react";

interface NavLink {
  label: string;
  href: string;
  /** Extra routes that should light this link up, as in the phone tab bar. */
  alsoMatches?: string[];
}

/** The same destinations as the phone's tab bar and menu drawer, so nothing a
 * shopper can reach on a phone is missing on a laptop. Cart, wishlist and
 * account sit in the header row above as icons. */
const LINKS: NavLink[] = [
  { label: "Home", href: "/", alsoMatches: ["/product/", "/products/"] },
  { label: "Categories", href: "/categories", alsoMatches: ["/category/"] },
  { label: "Offers", href: "/offers" },
  { label: "New Arrivals", href: "/new-arrivals" },
  { label: "My Orders", href: "/account/orders" },
];

/** The laptop header's link row. A client component only because the current
 * page is read from the browser's path. */
export default function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="mx-auto flex h-11 w-full max-w-shell items-center gap-1 px-6"
    >
      {LINKS.map(({ label, href, alsoMatches }) => {
        const matchesExtra = alsoMatches?.some((prefix) => pathname.startsWith(prefix)) ?? false;
        const isActive =
          href === "/" ? pathname === "/" || matchesExtra : pathname.startsWith(href) || matchesExtra;

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              isActive
                ? "bg-brand-tint text-brand-dark"
                : "text-ink-muted hover:bg-brand-mist hover:text-brand-darkest"
            }`}
          >
            {label}
          </Link>
        );
      })}

      {/* The menu drawer's "More" section. Hidden on narrow tablets, where the
          row has no room for it; the account page links to support too. */}
      <div className="ml-auto hidden items-center gap-5 text-xs font-medium text-ink-muted lg:flex">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-brand" strokeWidth={2.25} />
          Delivering across Bangladesh
        </span>
        <a
          href="mailto:support@zupona.shop?subject=Selling%20on%20Zupona"
          className="hover:text-brand-darkest"
        >
          Sell on Zupona
        </a>
        <a href="mailto:support@zupona.shop" className="hover:text-brand-darkest">
          Help
        </a>
      </div>
    </nav>
  );
}
