import Link from "next/link";
import { Search, Bell, Leaf } from "lucide-react";

/** The Account section's own header.
 *
 * Sticky, because the account page is a long scroll and the notification bell
 * is the one control a shopper reaches for mid-page. It stays below the tab
 * bar's layer so the two never fight.
 *
 * The search pill is a link to the home page rather than an input: the
 * storefront's only product search is the live filter that lives in the home
 * header (`SearchProvider` + the product grid), so this takes you to it
 * instead of pretending to be a second search box that goes nowhere. */
export default function AccountHeader({ unreadCount }: { unreadCount: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-brand-tint bg-white">
      <div className="flex items-center gap-2 px-3.5 py-2.5 sm:gap-3 sm:px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-tint">
            <Leaf className="h-[18px] w-[18px] text-brand" strokeWidth={2.25} />
          </span>
          <span className="hidden leading-tight min-[360px]:block">
            <span className="block text-[15px] font-extrabold tracking-tight text-brand-darkest">
              Zupona
            </span>
            <span className="block text-[9px] font-medium text-ink-muted">Trusted Online Shop</span>
          </span>
        </Link>

        {/* Fluid: this is what gives way first when the viewport narrows. */}
        <Link
          href="/"
          aria-label="Search products on the Zupona home page"
          className="flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-full bg-brand-mist px-3 text-ink-muted ring-1 ring-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Search className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          <span className="truncate text-[11px]">Search products</span>
        </Link>

        <Link
          href="/account/notifications"
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-brand-darkest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Bell className="h-[21px] w-[21px]" strokeWidth={2.1} />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-accent-red px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
