import StickyHeader from "./StickyHeader";
import DesktopHeader from "./DesktopHeader";
import SearchBar from "./SearchBar";
import { getCurrentUser } from "@/lib/session";
import { getWishlistCount } from "@/lib/wishlist";

/** The storefront header: brand and shortcuts on top, menu and search below.
 *
 * The wishlist count is read on the server so the badge is correct on first
 * paint rather than popping in after hydration. The markup itself lives in
 * `StickyHeader`, which needs the browser to know how far the page has
 * scrolled; this file exists to keep that data read on the server.
 *
 * The cart sits in the tab bar now rather than up here, which spares the home
 * page the second count query it used to run alongside this one.
 *
 * On a laptop `StickyHeader` hides and `DesktopHeader` shows instead, carrying
 * the same live search box so typing still filters the grid below. */
export default async function Header() {
  const user = await getCurrentUser();
  const wishlistCount = await getWishlistCount(user?.id ?? null);

  return (
    <>
      <StickyHeader wishlistCount={wishlistCount} />
      <DesktopHeader search={<SearchBar size="large" />} />
    </>
  );
}
