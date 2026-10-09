"use client";

import { useSyncExternalStore } from "react";
import ProductCard, { cardLineCount } from "@/components/home/ProductCard";
import type { ProductSummary } from "@/types";

/** Columns per width, matching the grids this replaced: two on a phone, then
 * three from the `tab` breakpoint (700px), four, five and six from Tailwind's
 * lg, xl and 2xl. Widest first, so the first match wins. */
const COLUMN_QUERIES: [string, number][] = [
  ["(min-width: 1536px)", 6],
  ["(min-width: 1280px)", 5],
  ["(min-width: 1024px)", 4],
  ["(min-width: 700px)", 3],
];
const PHONE_COLUMNS = 2;

function subscribe(onChange: () => void) {
  const lists = COLUMN_QUERIES.map(([query]) => window.matchMedia(query));
  lists.forEach((list) => list.addEventListener("change", onChange));
  return () => lists.forEach((list) => list.removeEventListener("change", onChange));
}

function columnCount(): number {
  return COLUMN_QUERIES.find(([query]) => window.matchMedia(query).matches)?.[1] ?? PHONE_COLUMNS;
}

const noop = () => () => {};

/** A card's height in rough pixels at phone width: the 4:5 photo, the name and
 * the price row, plus one short line for each optional line it carries. Only
 * the comparison between cards matters, so the figures need not be exact. */
const CARD_BASE = 265;
const CARD_LINE = 14;

/** Product cards in independent columns, Temu-style.
 *
 * A card shows only the lines that are true of its product, so cards differ
 * in height. In an ordinary grid a short card sits beside a tall one in the
 * same row and leaves a hole under itself; here each column runs on by itself
 * and nothing is left empty.
 *
 * Each card goes to whichever column is shortest so far, ties to the left.
 * Heights are worked out from what the card will draw rather than measured,
 * so placing costs no layout pass and no second render, and because a card
 * only ever looks at the cards before it, a grid that grows a page at a time
 * never moves a card that is already on screen. Cards of equal height simply
 * alternate left and right, which is the old grid's order.
 *
 * The server cannot know the screen, so it renders the phone's two columns.
 * Until the page hydrates, from the `tab` breakpoint up the column wrappers
 * dissolve (`display: contents`) into an ordinary grid ordered by each card's
 * place in the list, so a laptop never sees two giant columns flash first. */
export default function MasonryGrid({
  products,
  wishlistIds,
  isSignedIn,
  className = "",
}: {
  products: ProductSummary[];
  wishlistIds: Set<string> | string[];
  isSignedIn: boolean;
  className?: string;
}) {
  const columns = useSyncExternalStore(subscribe, columnCount, () => PHONE_COLUMNS);
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const wishlisted = wishlistIds instanceof Set ? wishlistIds : new Set(wishlistIds);

  const heights = new Array<number>(columns).fill(0);
  const placed: { product: ProductSummary; index: number }[][] = Array.from(
    { length: columns },
    () => []
  );
  products.forEach((product, index) => {
    let shortest = 0;
    for (let column = 1; column < columns; column++) {
      if (heights[column] < heights[shortest]) shortest = column;
    }
    placed[shortest].push({ product, index });
    heights[shortest] += CARD_BASE + CARD_LINE * cardLineCount(product);
  });

  return (
    <div
      className={`flex items-start gap-1.5 tab:gap-3 ${
        hydrated ? "" : "tab:grid tab:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
      } ${className}`}
    >
      {placed.map((column, columnIndex) => (
        <div
          key={columnIndex}
          className={`flex min-w-0 flex-1 flex-col gap-1.5 tab:gap-3 ${hydrated ? "" : "tab:contents"}`}
        >
          {column.map(({ product, index }) => (
            <div key={product.id} style={{ order: index }} className="min-w-0">
              <ProductCard
                product={product}
                isWishlisted={wishlisted.has(product.id)}
                isSignedIn={isSignedIn}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
