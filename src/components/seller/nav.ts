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
  { label: "Store", href: "/seller/settings", icon: "settings" },
];

/** Whether a nav entry should read as the current section.
 *
 * `/seller` is special-cased: as a prefix it matches every page in the panel,
 * so the dashboard would otherwise stay lit on every screen. */
export function isSellerSectionActive(pathname: string, href: string): boolean {
  if (href === "/seller") return pathname === "/seller";
  return pathname === href || pathname.startsWith(`${href}/`);
}
