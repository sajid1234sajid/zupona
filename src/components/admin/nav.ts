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

/** Whether a nav entry should read as the current section.
 *
 * `/admin` is special-cased: as a prefix it matches every admin page, so the
 * dashboard would otherwise stay lit on every screen. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Human trail for the header, e.g. Products › Add Product. */
export function breadcrumbFor(pathname: string): string[] {
  for (const item of NAV_ITEMS) {
    const child = item.children?.find((entry) => entry.href === pathname);
    if (child) return [item.label, child.label];
    if (isActive(pathname, item.href)) return [item.label];
  }
  return ["Dashboard"];
}
