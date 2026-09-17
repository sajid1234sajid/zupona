import Link from "next/link";
import { Bell } from "lucide-react";
import ZuponaMark from "@/components/brand/ZuponaMark";
import SearchLauncher from "@/components/search/SearchLauncher";

/** The Account section's own header.
 *
 * Sticky, because the account page is a long scroll and the notification bell
 * is the one control a shopper reaches for mid-page. It stays below the tab
 * bar's layer so the two never fight.
 *
 * The search pill opens the search sheet over the account page. It used to be
 * a link to the home page, back when the only product search was the live
 * filter in the home header -- which meant tapping search here abandoned the
 * page you were on and left you to find the box yourself. */
export default function AccountHeader({ unreadCount }: { unreadCount: number }) {
  return (
    // Phones only; `DesktopHeader` takes over from the `tab` breakpoint up.
    <header className="sticky top-0 z-30 border-b border-brand-tint bg-white tab:hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 sm:gap-3 sm:px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <ZuponaMark className="h-9 w-9 shrink-0" />
          <span className="hidden leading-tight min-[360px]:block">
            <span className="block text-[15px] font-extrabold tracking-tight text-brand-darkest">
              Zupona
            </span>
            <span className="block text-[9px] font-medium text-ink-muted">Trusted Online Shop</span>
          </span>
        </Link>

        <SearchLauncher variant="pill" />

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
