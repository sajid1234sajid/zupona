import Link from "next/link";
import { Heart, Search, ShoppingCart, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ZuponaMark from "@/components/brand/ZuponaMark";
import { getCurrentUser, getShopper } from "@/lib/session";
import { getWishlistCount } from "@/lib/wishlist";
import { getCartCount } from "@/lib/cart";
import DesktopNav from "./DesktopNav";

/** The laptop header, shown from the `tab` breakpoint (700px) up.
 *
 * Phones keep their own headers and the bottom tab bar; both hide themselves
 * at the same breakpoint this one appears at, so exactly one navigation is
 * ever on screen. Pages render this next to their phone header rather than
 * swapping one for the other, which is what leaves the phone layout untouched.
 *
 * The logo, search and the cart / wishlist / account shortcuts stay pinned;
 * the link row underneath scrolls away. The pinned row is `h-16`, and the home
 * page's filter chips stick at `tab:top-16` directly beneath it.
 *
 * `search` is the home page's live search box. Everywhere else the product
 * search lives only on the home page, so the slot is a link to it -- the same
 * choice the account header makes on a phone. */
export default async function DesktopHeader({ search }: { search?: React.ReactNode }) {
  const [user, shopper] = await Promise.all([getCurrentUser(), getShopper()]);
  const [wishlistCount, cartCount] = await Promise.all([
    getWishlistCount(user?.id ?? null),
    getCartCount(shopper?.id ?? null),
  ]);

  const firstName = user?.name.trim().split(/\s+/)[0];

  return (
    <>
      <header className="sticky top-0 z-40 hidden h-16 border-b border-line-soft bg-white tab:block">
        <div className="mx-auto flex h-full w-full max-w-shell items-center gap-6 px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <ZuponaMark className="h-9 w-9 shrink-0" />
            <span className="leading-tight">
              <span className="block text-[19px] font-extrabold leading-none text-brand-darkest">
                Zupona
              </span>
              <span className="mt-0.5 block text-[10.5px] font-medium text-brand">
                Trusted Online Shop
              </span>
            </span>
          </Link>

          <div className="flex min-w-0 flex-1 justify-center">
            <div className="flex w-full max-w-[560px]">
              {search ?? (
                <Link
                  href="/"
                  aria-label="Search products on the Zupona home page"
                  className="flex h-11 w-full min-w-0 items-center gap-2 rounded-full bg-brand-mist px-4 text-sm text-ink-faint ring-1 ring-line transition-colors hover:ring-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={2.25} />
                  <span className="truncate">Search for products, brands and more...</span>
                </Link>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <HeaderLink href="/wishlist" label="Wishlist" icon={Heart} count={wishlistCount} />
            <HeaderLink href="/cart" label="Cart" icon={ShoppingCart} count={cartCount} />
            <HeaderLink
              href={user ? "/account" : "/account/login"}
              label={firstName ?? "Sign in"}
              icon={User}
              count={0}
            />
          </div>
        </div>
      </header>

      <div className="hidden border-b border-line-soft bg-white tab:block">
        <DesktopNav />
      </div>
    </>
  );
}

/** An icon shortcut; the word beside it only appears once there is room. */
function HeaderLink({
  href,
  label,
  icon: Icon,
  count,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-label={count > 0 ? `${label}, ${count}` : label}
      className="flex h-11 items-center gap-2 rounded-full px-3 text-[13px] font-semibold text-brand-darkest transition-colors hover:bg-brand-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <span className="relative">
        <Icon className="h-[21px] w-[21px]" strokeWidth={2} />
        {count > 0 && (
          <span className="absolute -right-2 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-accent-red px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span className="hidden max-w-[110px] truncate capitalize lg:inline">{label}</span>
    </Link>
  );
}
