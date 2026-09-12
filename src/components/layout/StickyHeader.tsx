"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, MapPin, ChevronDown, Heart, ShoppingCart, Leaf } from "lucide-react";
import SearchBar from "./SearchBar";
import MenuDrawer from "./MenuDrawer";

/** The storefront header, pinned to the top of the viewport.
 *
 * The search box must stay reachable no matter how far the shopper has
 * scrolled, so the whole header sticks rather than scrolling away. Keeping the
 * full two-row header on screen would eat a third of a phone, so once the page
 * has moved the brand row folds away and only the search row is left: a
 * compact bar of logo plus search box.
 *
 * The counts arrive as props because the header above this is a server
 * component -- the badges are correct on first paint instead of popping in
 * after hydration, and this file stays about scroll behaviour.
 *
 * `COLLAPSED_HEIGHT` is the height of that folded bar, and the home page's
 * filter row sticks directly underneath it. If the padding here changes, that
 * constant and the offset in `FeaturedProducts` have to change with it. */
export const COLLAPSED_HEIGHT = 54;

/** Fold past this, unfold before it. The gap keeps the header from flickering
 * when a finger rests on the screen right at the threshold. */
const FOLD_AT = 48;
const UNFOLD_AT = 24;

export default function StickyHeader({
  wishlistCount,
  cartCount,
}: {
  wishlistCount: number;
  cartCount: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The drawer is only put into the page once the shopper has actually asked
  // for it, and stays from then on so it can slide out again. A visit that
  // never opens the menu renders none of its markup.
  const [menuMounted, setMenuMounted] = useState(false);

  useEffect(() => {
    let frame = 0;

    const read = () => {
      frame = 0;
      const y = window.scrollY;
      setCollapsed((was) => (was ? y > UNFOLD_AT : y > FOLD_AT));
    };

    // Coalesced into one frame: scroll fires far more often than the header
    // can usefully change, and re-rendering on every event is what makes a
    // collapsing header feel jittery.
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    // Read once for a page restored mid-scroll, where no scroll event fires.
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-brand-dark px-3.5 pb-2.5 pt-2 text-white">
      {/* A 0fr/1fr grid row rather than a max-height: the row animates to its
          own natural height, so nothing has to hard-code how tall the brand
          block is. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
      >
        {/* The clipping box the fold needs would shave the top pixel off the
            wishlist and cart badges, which sit slightly above their icons, so
            the row carries a little headroom of its own. */}
        <div className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 pb-2 pt-1">
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

              <Link
                href="/cart"
                aria-label={`Cart, ${cartCount} items`}
                className="relative block"
              >
                <ShoppingCart className="h-[18px] w-[18px]" strokeWidth={2.1} />
                <span className="absolute -right-1.5 -top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-accent-amber px-1 text-[8px] font-bold text-brand-darkest">
                  {cartCount}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* One 28px slot, two faces. The menu button wears the hamburger while
            the brand row is showing and the leaf mark once it has folded away,
            so the collapsed bar still carries the logo beside the search box
            without the row changing width as it swaps. */}
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setMenuMounted(true);
            setMenuOpen(true);
          }}
          className="relative h-7 w-7 shrink-0"
        >
          <Menu
            className={`absolute left-1 top-1 h-5 w-5 transition-opacity duration-200 ease-out ${
              collapsed ? "opacity-0" : "opacity-100"
            }`}
            strokeWidth={2.25}
          />
          <span
            className={`absolute inset-0 grid place-items-center rounded-lg bg-white/15 transition-[opacity,transform] duration-200 ease-out ${
              collapsed ? "scale-100 opacity-100" : "scale-75 opacity-0"
            }`}
          >
            <Leaf className="h-4 w-4 text-white" strokeWidth={2.25} />
          </span>
        </button>

        <SearchBar />
      </div>

      {menuMounted && (
        <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      )}
    </header>
  );
}
