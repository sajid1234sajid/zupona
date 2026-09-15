import BottomNavBar from "./BottomNavBar";
import { getShopper } from "@/lib/session";
import { getCartCount } from "@/lib/cart";

/** The tab bar, with the cart's count read on the server.
 *
 * Every page renders `<BottomNav />` with no props, which is why the count is
 * fetched here rather than threaded through all fourteen of them -- a page
 * added later gets a correct badge for free, and none of them can forget to
 * pass it. The session lookup is memoised per request, so on a page that has
 * already asked who is signed in this costs one small indexed read; for a
 * browser with no cart yet `getCartCount` returns zero without touching the
 * database at all. The count is the shopper's, so a guest's cart shows too. */
export default async function BottomNav() {
  const shopper = await getShopper();
  const cartCount = await getCartCount(shopper?.id ?? null);

  return <BottomNavBar cartCount={cartCount} />;
}
