"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Bell,
  CreditCard,
  Heart,
  LayoutDashboard,
  MapPin,
  MessageSquareText,
  Package,
  PackageOpen,
  ShieldCheck,
  Star,
  Ticket,
  UserRound,
} from "lucide-react";

const GROUPS = [
  { title: "", items: [{ label: "Overview", href: "/account", icon: LayoutDashboard }] },
  {
    title: "Orders",
    items: [
      { label: "My orders", href: "/account/orders", icon: Package },
      { label: "Returns & refunds", href: "/account/returns", icon: PackageOpen },
    ],
  },
  {
    title: "Activity",
    items: [
      { label: "My reviews", href: "/account/reviews", icon: MessageSquareText },
      { label: "Wishlist", href: "/wishlist", icon: Heart },
    ],
  },
  {
    title: "Rewards",
    items: [
      { label: "Zupona Points", href: "/account/points", icon: Star },
      { label: "My coupons", href: "/account/coupons", icon: Ticket },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Profile", href: "/account/edit", icon: UserRound },
      { label: "Addresses", href: "/account/addresses", icon: MapPin },
      { label: "Payment methods", href: "/account/payment-methods", icon: CreditCard },
      { label: "Notifications", href: "/account/notifications", icon: Bell },
      { label: "Security", href: "/account/security", icon: ShieldCheck },
    ],
  },
];

/** The account's left-hand menu on a wide screen, beside every account page.
 *
 * Fixed to the left edge with the page moved over to make room, so the pages
 * themselves -- each drawing its own header and column -- need no change. On
 * a phone, and on the sign-in page, it is not there at all. */
export default function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/account/login")) return <>{children}</>;

  const active = (href: string) =>
    href === "/account" ? pathname === "/account" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav
        aria-label="Account"
        className="fixed inset-y-0 left-0 z-30 hidden w-[240px] overflow-y-auto border-r border-line-soft bg-white px-3 pb-6 pt-5 min-[1200px]:block"
      >
        <Link href="/" className="mb-4 block px-3 text-[13px] font-semibold text-ink-muted hover:text-brand">
          ← Back to shop
        </Link>
        <p className="px-3 text-lg font-extrabold text-heading">My account</p>
        {GROUPS.map((group) => (
          <div key={group.title || "top"} className="mt-4">
            {group.title ? (
              <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{group.title}</p>
            ) : null}
            <ul>
              {group.items.map(({ label, href, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active(href) ? "page" : undefined}
                    className={`flex h-10 items-center gap-2.5 rounded-xl px-3 text-[13.5px] font-semibold ${
                      active(href) ? "bg-brand-tint text-brand-darkest" : "text-ink hover:bg-brand-mist"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="min-[1200px]:pl-[240px]">{children}</div>
    </>
  );
}
