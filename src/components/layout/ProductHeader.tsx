import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";
import ZuponaMark from "@/components/brand/ZuponaMark";
import SearchLauncher from "@/components/search/SearchLauncher";
import { getCurrentUser, getShopper } from "@/lib/session";
import { getWishlistCount } from "@/lib/wishlist";
import { getCartCount } from "@/lib/cart";

/** The header every page outside the home page and the account section wears.
 *
 * The search control opens the search sheet over the current page rather than
 * navigating anywhere: it used to be a button with no handler at all, so
 * tapping it on offers, categories, the cart or a product page did nothing. */
export default async function ProductHeader() {
  const [user, shopper] = await Promise.all([getCurrentUser(), getShopper()]);
  const [wishlistCount, cartCount] = await Promise.all([
    getWishlistCount(user?.id ?? null),
    getCartCount(shopper?.id ?? null),
  ]);

  return (
    <header className="flex items-center justify-between border-b border-line-soft bg-white px-4 py-3">
      <Link href="/" className="flex items-center gap-2">
        <ZuponaMark className="h-9 w-9 shrink-0" />
        <span className="flex flex-col leading-tight">
          <span className="text-[19px] font-extrabold leading-none text-brand-darkest">Zupona</span>
          <span className="mt-0.5 text-[10.5px] font-medium text-brand">Trusted Online Shop</span>
        </span>
      </Link>

      <div className="flex items-center gap-4">
        <SearchLauncher />
        <Link href="/wishlist" aria-label="Wishlist" className="relative">
          <Heart className="h-5 w-5 text-ink" />
          {wishlistCount > 0 && (
            <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold text-white">
              {wishlistCount}
            </span>
          )}
        </Link>
        <Link href="/cart" aria-label="Cart" className="relative">
          <ShoppingCart className="h-5 w-5 text-ink" />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold text-white">
              {cartCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
