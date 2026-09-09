import Link from "next/link";
import {
  MapPin,
  CreditCard,
  Bell,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Star,
  Package,
  Heart,
  BadgeCheck,
  Headset,
  Camera,
  ShoppingBag,
} from "lucide-react";
import AccountHeader from "@/components/layout/AccountHeader";
import BottomNav from "@/components/layout/BottomNav";
import BotanicalBackdrop from "@/components/home/BotanicalBackdrop";
import OrderCard from "@/components/order/OrderCard";
import { logOutAction } from "@/app/account/actions";
import type { AuthUser, Order } from "@/types";

const MENU_ITEMS = [
  {
    label: "Saved Addresses",
    subtitle: "Manage your delivery addresses",
    icon: MapPin,
    href: "/account/addresses",
  },
  {
    label: "Payment Methods",
    subtitle: "Cards, mobile banking & COD",
    icon: CreditCard,
    href: "/account/payment-methods",
  },
  {
    label: "Notifications",
    subtitle: "Order updates & offers",
    icon: Bell,
    href: "/account/notifications",
  },
  {
    label: "Profile & Security",
    subtitle: "Password, phone & email",
    icon: ShieldCheck,
    href: "/account/security",
  },
];

/** Shared by every tappable card, so the surface and the focus ring stay
 * identical whether the element is a link or a button. */
const CARD =
  "rounded-2xl bg-white shadow-sm ring-1 ring-brand-darkest/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

/** The signed-in account screen.
 *
 * A server component: everything on it is either a link or the log-out form
 * posting a server action, so none of it needs client JavaScript.
 *
 * Width: the column follows the rest of the storefront at `max-w-md`, which is
 * what the fixed tab bar uses too -- the two have to agree or the bar stops
 * lining up with the page. Inside the column nothing is a fixed pixel width:
 * every row is a flex or grid track whose text is `min-w-0` and truncating, so
 * a long name or a long status label shortens instead of pushing the page
 * sideways on a 320px screen. */
export default function AccountProfile({
  user,
  latestOrder,
  orderCount,
  wishlistCount,
  unreadNotificationCount,
}: {
  user: AuthUser;
  latestOrder: Order | null;
  orderCount: number;
  wishlistCount: number;
  unreadNotificationCount: number;
}) {
  const initials = user.name.trim().slice(0, 2).toUpperCase() || "ZU";
  const contact = user.phone ?? user.email ?? "";

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-[calc(66px+env(safe-area-inset-bottom))]">
      <AccountHeader unreadCount={unreadNotificationCount} />

      <main className="relative flex-1 px-3.5 pt-3.5 sm:px-4">
        {/* ---------------- Profile ---------------- */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-darkest via-brand-dark to-brand p-4 text-white shadow-[0_12px_26px_-14px_rgba(0,85,61,0.7)]">
          <BotanicalBackdrop
            className="pointer-events-none absolute inset-0 h-full w-full"
            tone="#0a936a"
            opacity={0.35}
            blossoms={false}
          />

          <div className="relative flex items-center gap-3">
            <Link
              href="/account/edit"
              aria-label="Edit your profile photo"
              className="relative block shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark"
            >
              <span className="grid h-[58px] w-[58px] place-items-center overflow-hidden rounded-full bg-white/15 text-lg font-bold ring-2 ring-white/40 sm:h-16 sm:w-16">
                {user.avatarUrl ? (
                  // Avatar URLs are user-supplied and can point at any host, so
                  // they stay on a plain <img>: next/image would need every one
                  // of those hosts allow-listed in next.config.ts and would
                  // fail the request for the rest.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={`Profile photo of ${user.name}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </span>
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-white text-brand-dark shadow-sm"
              >
                <Camera className="h-3 w-3" strokeWidth={2.5} />
              </span>
            </Link>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-extrabold capitalize leading-tight">
                {user.name}
              </p>
              {contact && (
                <p className="mt-0.5 truncate text-[11.5px] text-white/70">{contact}</p>
              )}
              <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-white/20 px-2 py-[3px] text-[9.5px] font-semibold text-white">
                <BadgeCheck className="h-3 w-3 shrink-0 text-brand-light" />
                <span className="truncate">Verified Account</span>
              </span>
            </div>

            <Link
              href="/account/edit"
              className="flex min-h-11 shrink-0 items-center rounded-full bg-white px-3 text-[11px] font-bold text-brand-darkest shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark sm:px-3.5 sm:text-[12px]"
            >
              Edit Profile
            </Link>
          </div>
        </section>

        {/* ---------------- Support ---------------- */}
        <a
          href="mailto:support@zupona.shop"
          className="relative mt-3 flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-dark to-brand p-3.5 text-white shadow-[0_10px_22px_-16px_rgba(0,85,61,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <BotanicalBackdrop
            className="pointer-events-none absolute inset-0 h-full w-full"
            tone="#ffffff"
            opacity={0.16}
            blossoms={false}
          />
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15">
            <Headset className="h-5 w-5" />
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold">Need Help?</span>
            {/* Wraps rather than truncates: on a 320px screen the sentence is
                the only thing telling you what the button does. */}
            <span className="mt-0.5 block text-[10.5px] leading-tight text-white/75">
              Our support team is here for you
            </span>
          </span>
          <span className="relative flex min-h-9 shrink-0 items-center rounded-full bg-white px-3.5 text-[11px] font-bold text-brand-dark">
            Message
          </span>
        </a>

        {/* ---------------- Points ---------------- */}
        <Link href="/account/points" className={`mt-2.5 flex items-center gap-3 p-3.5 ${CARD}`}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-amber/15">
            <Star className="h-5 w-5 fill-accent-amber text-accent-amber" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold text-brand-darkest">Points</span>
            <span className="mt-0.5 block truncate text-[10.5px] text-ink-muted">
              Earn points &amp; get exclusive rewards
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-bold text-brand-dark">
            {user.points} pts
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted/60" />
        </Link>

        {/* ---------------- Order / wishlist counts ---------------- */}
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <Link href="/account/orders" className={`flex flex-col p-3.5 ${CARD}`}>
            <span className="flex items-center justify-between gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-tint text-brand">
                <Package className="h-[18px] w-[18px]" />
              </span>
              {/* A zero is worth showing -- it says the section is empty
                  rather than still loading -- but it should not shout in the
                  same colour as a real count. */}
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  orderCount > 0 ? "bg-brand text-white" : "bg-brand-tint text-brand-dark"
                }`}
              >
                {orderCount}
              </span>
            </span>
            <span className="mt-2 block text-[13px] font-bold text-brand-darkest">My Orders</span>
            <span className="mt-0.5 block text-[10px] leading-snug text-ink-muted">
              Track orders &amp; delivery updates
            </span>
          </Link>

          <Link href="/wishlist" className={`flex flex-col p-3.5 ${CARD}`}>
            <span className="flex items-center justify-between gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-red/10 text-accent-red">
                <Heart className="h-[18px] w-[18px]" />
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  wishlistCount > 0
                    ? "bg-accent-red text-white"
                    : "bg-accent-red/10 text-accent-red/70"
                }`}
              >
                {wishlistCount}
              </span>
            </span>
            <span className="mt-2 block text-[13px] font-bold text-brand-darkest">Listed</span>
            <span className="mt-0.5 block text-[10px] leading-snug text-ink-muted">
              Products you saved for later
            </span>
          </Link>
        </div>

        {/* ---------------- Latest order ---------------- */}
        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
            <h2 className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-bold text-brand-darkest">
              <ShoppingBag className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate">My Orders</span>
            </h2>
            {latestOrder && (
              <Link
                href="/account/orders"
                className="-my-1 flex min-h-11 shrink-0 items-center gap-0.5 rounded-full px-2 text-[11.5px] font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                View All
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {latestOrder ? (
            <OrderCard order={latestOrder} />
          ) : (
            <div className={`flex flex-col items-center gap-2 px-4 py-7 text-center ${CARD}`}>
              <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-tint">
                <Package className="h-6 w-6 text-brand" />
              </span>
              <p className="text-[13px] font-bold text-brand-darkest">No orders yet</p>
              <p className="text-[11px] text-ink-muted">
                Your orders will appear here once you place one.
              </p>
              <Link
                href="/"
                className="mt-1 flex min-h-11 items-center rounded-full bg-brand px-6 text-[12.5px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Start Shopping
              </Link>
            </div>
          )}
        </section>

        {/* ---------------- Preferences ---------------- */}
        <section className="mt-4">
          <h2 className="mb-2 px-0.5 text-[13.5px] font-bold text-brand-darkest">
            Account &amp; Preferences
          </h2>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-brand-darkest/[0.04]">
            {MENU_ITEMS.map(({ label, subtitle, icon: Icon, href }, index) => (
              <Link
                key={label}
                href={href}
                className={`flex min-h-[58px] w-full items-center gap-3 px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
                  index !== MENU_ITEMS.length - 1 ? "border-b border-brand-tint/70" : ""
                }`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-tint text-brand">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-brand-darkest">
                    {label}
                  </span>
                  <span className="mt-0.5 block truncate text-[10.5px] text-ink-muted">
                    {subtitle}
                  </span>
                </span>
                {label === "Notifications" && unreadNotificationCount > 0 && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent-red px-1.5 text-[10px] font-bold text-white">
                    {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted/50" />
              </Link>
            ))}
          </div>
        </section>

        {/* ---------------- Log out ---------------- */}
        <form action={logOutAction} className="mt-3 pb-2">
          <button
            type="submit"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-accent-red/25 bg-white text-[12.5px] font-bold text-accent-red shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-2"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </form>
      </main>

      <BottomNav />
    </div>
  );
}
