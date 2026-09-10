/** The rules that turn a set of chosen options into a sellable variant.
 *
 * Kept apart from the components because this is where the product page is
 * either correct or not: which combination the shopper has landed on, what it
 * costs, how many are left, and which choices would lead nowhere. None of it
 * touches React, so it can be reasoned about -- and tested -- on its own. */

import type { StoreProduct, StoreVariant } from "@/lib/storefront";

/** Option group key to chosen value, e.g. `{ color: "Olive", size: "M" }`. */
export type Selections = Record<string, string>;

/**
 * The variant matching every choice, or null when the choices do not name one.
 *
 * Every group has to agree, not just the ones that happen to be set: a shirt
 * with a colour but no size chosen yet is not a variant, and treating it as
 * one would price and stock the page from whichever row happened to be first.
 *
 * A product with no options at all has one implicit variant, and an empty
 * `groupKeys` matches it -- which is the correct answer, not an accident.
 */
export function findVariant(
  variants: StoreVariant[],
  selections: Selections,
  groupKeys: string[]
): StoreVariant | null {
  if (variants.length === 0) return null;
  return (
    variants.find((variant) =>
      groupKeys.every((key) => variant.optionValues[key] === selections[key])
    ) ?? null
  );
}

/**
 * Whether choosing `value` in `groupKey` still leads somewhere buyable.
 *
 * A value is offered when at least one variant has stock, carries that value,
 * and agrees with everything else already chosen. So on a shirt that is out of
 * Olive in L, picking L greys Olive out rather than letting the shopper select
 * a combination that cannot be bought.
 *
 * Products with no variants offer everything: there is nothing to contradict.
 */
export function isValueAvailable(
  variants: StoreVariant[],
  selections: Selections,
  groupKey: string,
  value: string
): boolean {
  if (variants.length === 0) return true;

  return variants.some((variant) => {
    if (variant.available <= 0) return false;
    if (variant.optionValues[groupKey] !== value) return false;

    return Object.entries(selections).every(
      ([key, chosen]) => key === groupKey || variant.optionValues[key] === chosen
    );
  });
}

/**
 * What the page opens on.
 *
 * Taken from the first variant that has stock rather than by picking the first
 * value of each group in turn: choosing greedily can land on a combination
 * that does not exist -- Olive and M, on a shirt that only stocks Olive in L
 * and Black in M -- and the page would open on an unbuyable selection.
 */
export function initialSelections(product: StoreProduct): Selections {
  const groups = product.optionGroups;
  if (groups.length === 0) return {};

  const candidate =
    product.variants.find((variant) => variant.available > 0) ?? product.variants[0];

  if (candidate) {
    const fromVariant: Selections = {};
    for (const group of groups) {
      const value = candidate.optionValues[group.key];
      if (value) fromVariant[group.key] = value;
    }
    if (Object.keys(fromVariant).length === groups.length) return fromVariant;
  }

  // No variant covers every group (a half-configured product). Fall back to
  // the first value of each, which at least renders a coherent selector.
  const firstValues: Selections = {};
  for (const group of groups) {
    if (group.values[0]) firstValues[group.key] = group.values[0].value;
  }
  return firstValues;
}

/** Price, stock and comparison figures for the current selection.
 *
 * Falls back to the product's own numbers when no variant is resolved, so a
 * product without options still prices and stocks correctly. */
export function resolvePricing(product: StoreProduct, variant: StoreVariant | null) {
  const price = variant?.price ?? product.price;
  const compareAtPrice = variant?.compareAtPrice ?? product.oldPrice;
  const available = variant ? variant.available : product.stockTotal;
  const discountPercent =
    compareAtPrice > price ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : 0;

  return { price, compareAtPrice, available, discountPercent };
}
