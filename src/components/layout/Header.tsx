import Link from "next/link";
import { Menu, MapPin, ChevronDown, Heart, ShoppingCart, Leaf } from "lucide-react";
import SearchBar from "./SearchBar";
import { getCurrentUser } from "@/lib/session";
import { getWishlistCount } from "@/lib/wishlist";
import { getCartCount } from "@/lib/cart";

/** The storefront header: brand and shortcuts on top, menu and search below.
 *
 * The counts are read on the server so the badges are correct on first paint
 * rather than popping in after hydration. */
export default async function Header() {
  const user = await getCurrentUser();
  const [wishlistCount, cartCount] = await Promise.all([
    getWishlistCount(user?.id ?? null),
    getCartCount(user?.id ?? null),
  ]);

  return (
    <header className="bg-brand-dark px-3.5 pt-2 pb-2.5 text-white">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15">
            <Leaf className="h-4 w-4 text-white" strokeWidth={2.25} />
          </span>
          <span className="min-w-0 leading-none">
            <span className="block text-[17px] font-extrabold tracking-tight">Zupona</span>
            <span className="mt-0.5 block text-[8px] font-medium text-white/70">
              Trusted Online Shop
            </span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-0.5 rounded-full border border-white/30 px-2 py-[3px] text-[9px] font-medium"
          >
            <MapPin className="h-3 w-3" strokeWidth={2.25} />
            Bangladesh
            <ChevronDown className="h-3 w-3" strokeWidth={2.25} />
          </button>

          <Link href="/wishlist" aria-label="Wishlist" className="relative block">
            <Heart className="h-[18px] w-[18px]" strokeWidth={2.1} />
            {wishlistCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-accent-red px-1 text-[8px] font-bold text-white">
                {wishlistCount}
              </span>
            )}
          </Link>

          <Link href="/cart" aria-label={`Cart, ${cartCount} items`} className="relative block">
            <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={2.1} />
            <span className="absolute -right-1.5 -top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-accent-amber px-1 text-[8px] font-bold text-brand-darkest">
              {cartCount}
            </span>
          </Link>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2.5">
        <button type="button" aria-label="Open menu" className="shrink-0">
          <Menu className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <SearchBar />
      </div>
    </header>
  );
}
