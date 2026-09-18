"use client";

import { useEffect } from "react";
import { useProductSearch } from "./SearchProvider";

/** Steps the home page's top half out of the way while a search is typed.
 *
 * The header's search box filters the product grid, and the grid starts below
 * the hero, the departments and the promo pair -- more than a phone screen
 * down. Typing filtered it correctly, but off screen, so on a phone the search
 * looked like it did nothing at all. While there is a query those sections are
 * hidden and the results sit directly under the search box; clearing the box
 * brings them back.
 *
 * Hidden rather than unmounted: the markup is server-rendered and its images
 * are already loaded, so bringing it back costs nothing. */
export default function HideWhileSearching({ children }: { children: React.ReactNode }) {
  const { query } = useProductSearch();
  const searching = query.trim().length > 0;

  // A search typed from far down the grid starts its results at the top.
  useEffect(() => {
    if (searching) window.scrollTo({ top: 0 });
  }, [searching]);

  return <div className={searching ? "hidden" : undefined}>{children}</div>;
}
