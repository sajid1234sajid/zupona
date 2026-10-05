/** Name-to-component map for the sidebar icons.
 *
 * `nav.ts` names icons as strings so it can be imported from server components
 * without dragging lucide's components across the serialization boundary. This
 * module is the client-side half that resolves those names. */

import {
  BarChart3,
  Bot,
  FolderTree,
  LayoutDashboard,
  Megaphone,
  Package,
  ScanSearch,
  Settings,
  ShoppingCart,
  Star,
  Store,
  Ticket,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  assistant: Bot,
  agent: ScanSearch,
  products: Package,
  categories: FolderTree,
  orders: ShoppingCart,
  customers: Users,
  distributors: Store,
  coupons: Ticket,
  marketing: Megaphone,
  reports: BarChart3,
  settings: Settings,
  // The Seller Center's own sections.
  analytics: BarChart3,
  reviews: Star,
  finance: Wallet,
  store: Store,
};
