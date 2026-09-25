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
  Settings,
  ShoppingCart,
  Store,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  assistant: Bot,
  products: Package,
  categories: FolderTree,
  orders: ShoppingCart,
  customers: Users,
  distributors: Store,
  coupons: Ticket,
  marketing: Megaphone,
  reports: BarChart3,
  settings: Settings,
};
