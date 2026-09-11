import Link from "next/link";
import { Search, Heart, ShoppingCart, Leaf } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getWishlistCount } from "@/lib/wishlist";
import { getCartCount } from "@/lib/cart";

export default async function ProductHeader() {
  const user = await getCurrentUser();
  const [wishlistCount, cartCount] = await Promise.all([
    getWishlistCount(user?.id ?? null),
    getCartCount(user?.id ?? null),
  ]);

  return (
    <header className="flex items-center justify-between border-b border-line-soft bg-white px-4 py-3">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tint">
          <Leaf className="h-4 w-4 text-brand" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-base font-bold text-brand-darkest">Zupona</span>
          <span className="text-[10px] text-ink-slate">Trusted Online Shop</span>
        </span>
      </Link>

      <div className="flex items-center gap-4">
        <button aria-label="Search">
          <Search className="h-5 w-5 text-ink" />
        </button>
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
