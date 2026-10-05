/** The Seller Center's navigation, in one place.
 *
 * Kept as data rather than JSX for the same reason the admin panel's is: the
 * desktop rail, the mobile drawer and the page headers all read from one
 * source and can never disagree about what a section is called. Icons are
 * named rather than imported so this module stays importable from server
 * components, and the names resolve through the admin panel's icon map --
 * there is no reason for the two back offices to draw an order with different
 * pictures. */

export interface SellerNavItem {
  label: string;
  href: string;
  /** A key in ICONS (src/components/admin/icons.ts). */
  icon: string;
}

export const SELLER_NAV: SellerNavItem[] = [
  { label: "Dashboard", href: "/seller", icon: "dashboard" },
  { label: "Products", href: "/seller/products", icon: "products" },
  { label: "Orders", href: "/seller/orders", icon: "orders" },
  { label: "Analytics", href: "/seller/analytics", icon: "analytics" },
  { label: "Reviews", href: "/seller/reviews", icon: "reviews" },
  { label: "Finance", href: "/seller/finance", icon: "finance" },
  { label: "Store", href: "/seller/settings", icon: "store" },
];

/** Puts a browser path back into the form these hrefs are written in.
 *
 * On `seller.zupona.com` the proxy serves the panel from the root, so the
 * address bar -- and `usePathname()` -- says `/orders` where this file says
 * `/seller/orders`. Comparing the two directly lit nothing on the real domain
 * while looking right on localhost, which has no subdomain to strip; the admin
 * panel's `toAdminPath` exists for the same reason. */
export function toSellerPath(pathname: string): string {
  if (pathname === "/seller" || pathname.startsWith("/seller/")) return pathname;
  return pathname === "/" ? "/seller" : `/seller${pathname}`;
}

/** Whether a nav entry should read as the current section.
 *
 * `/seller` is special-cased: as a prefix it matches every page in the panel,
 * so the dashboard would otherwise stay lit on every screen. */
export function isSellerSectionActive(pathname: string, href: string): boolean {
  const path = toSellerPath(pathname);
  if (href === "/seller") return path === "/seller";
  return path === href || path.startsWith(`${href}/`);
}
