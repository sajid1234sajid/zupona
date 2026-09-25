/** The admin sidebar's structure, in one place.
 *
 * Kept as data rather than JSX so the desktop rail, the mobile drawer and the
 * breadcrumb trail all read from the same source and can never disagree about
 * what a section is called or where it lives. Icons are named rather than
 * imported here so this module stays importable from server components. */

export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  /** A key in ICONS (src/components/admin/icons.ts). */
  icon: string;
  children?: NavChild[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "dashboard" },
  { label: "Assistant", href: "/admin/assistant", icon: "assistant" },
  {
    label: "Products",
    href: "/admin/products",
    icon: "products",
    children: [
      { label: "Add Product", href: "/admin/products/new" },
      { label: "All Products", href: "/admin/products" },
      { label: "Product Reviews", href: "/admin/products/reviews" },
    ],
  },
  { label: "Categories", href: "/admin/categories", icon: "categories" },
  { label: "Orders", href: "/admin/orders", icon: "orders" },
  { label: "Customers", href: "/admin/customers", icon: "customers" },
  { label: "Distributors", href: "/admin/distributors", icon: "distributors" },
  { label: "Coupons", href: "/admin/coupons", icon: "coupons" },
  {
    label: "Marketing",
    href: "/admin/marketing",
    icon: "marketing",
    children: [
      { label: "AI Command Center", href: "/admin/marketing/ai" },
      { label: "Campaigns", href: "/admin/marketing/campaigns" },
      { label: "Banners & Sales", href: "/admin/marketing" },
    ],
  },
  { label: "Reports", href: "/admin/reports", icon: "reports" },
  { label: "Settings", href: "/admin/settings", icon: "settings" },
];

/** Puts a browser path back into the form these hrefs are written in.
 *
 * The panel's pages live under `/admin/*`, but on `admin.zupona.com` the proxy
 * serves them from the root -- so the address bar, and therefore
 * `usePathname()`, says `/marketing` where this file says `/admin/marketing`.
 * Every comparison below was failing on the real domain as a result: nothing
 * was ever lit, no group opened itself, and the breadcrumb said "Dashboard" on
 * every screen. It looked correct in development only because localhost has no
 * subdomain to strip.
 *
 * Prefixing rather than stripping is what keeps both hosts working, and it is
 * safe here because this menu belongs to the admin panel alone -- the Seller
 * Center has its own. */
export function toAdminPath(pathname: string): string {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return pathname;
  return pathname === "/" ? "/admin" : `/admin${pathname}`;
}

/** Whether a nav entry should read as the current section.
 *
 * `/admin` is special-cased: as a prefix it matches every admin page, so the
 * dashboard would otherwise stay lit on every screen. */
export function isActive(pathname: string, href: string): boolean {
  const path = toAdminPath(pathname);
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(`${href}/`);
}

/** Human trail for the header, e.g. Products › Add Product. */
export function breadcrumbFor(pathname: string): string[] {
  const path = toAdminPath(pathname);

  for (const item of NAV_ITEMS) {
    const child = item.children?.find((entry) => entry.href === path);
    if (child) return [item.label, child.label];
    if (isActive(path, item.href)) return [item.label];
  }
  return ["Dashboard"];
}
