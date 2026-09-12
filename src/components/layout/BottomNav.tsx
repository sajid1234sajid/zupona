import BottomNavBar from "./BottomNavBar";
import { getCurrentUser } from "@/lib/session";
import { getCartCount } from "@/lib/cart";

/** The tab bar, with the cart's count read on the server.
 *
 * Every page renders `<BottomNav />` with no props, which is why the count is
 * fetched here rather than threaded through all fourteen of them -- a page
 * added later gets a correct badge for free, and none of them can forget to
 * pass it. `getCurrentUser` is memoised per request, so on a page that has
 * already asked who is signed in this costs one small indexed read; for a
 * signed-out visitor `getCartCount` returns zero without touching the
 * database at all. */
export default async function BottomNav() {
  const user = await getCurrentUser();
  const cartCount = await getCartCount(user?.id ?? null);

  return <BottomNavBar cartCount={cartCount} />;
}
