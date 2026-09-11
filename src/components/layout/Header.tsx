import StickyHeader from "./StickyHeader";
import { getCurrentUser } from "@/lib/session";
import { getWishlistCount } from "@/lib/wishlist";
import { getCartCount } from "@/lib/cart";

/** The storefront header: brand and shortcuts on top, menu and search below.
 *
 * The counts are read on the server so the badges are correct on first paint
 * rather than popping in after hydration. The markup itself lives in
 * `StickyHeader`, which needs the browser to know how far the page has
 * scrolled; this file exists to keep that data read on the server. */
export default async function Header() {
  const user = await getCurrentUser();
  const [wishlistCount, cartCount] = await Promise.all([
    getWishlistCount(user?.id ?? null),
    getCartCount(user?.id ?? null),
  ]);

  return <StickyHeader wishlistCount={wishlistCount} cartCount={cartCount} />;
}
