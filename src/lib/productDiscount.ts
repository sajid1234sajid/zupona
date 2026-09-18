/** The product form's "price + discount" rule, in one place.
 *
 * The catalog stores a selling price and a struck-through original, never the
 * discount itself. The admin form works the other way round, so the same
 * arithmetic runs when a product is saved, when its form is loaded again, and
 * in the form's own preview. Kept free of any runtime import so the client
 * form can share it with the server action. */

export type DiscountType = "none" | "percent" | "fixed";

export interface DiscountRule {
  type: DiscountType;
  value: number;
}

export const NO_DISCOUNT: DiscountRule = { type: "none", value: 0 };

export function hasDiscount(rule: DiscountRule): boolean {
  return rule.type !== "none" && rule.value > 0;
}

/** What the shopper pays for `base` under `rule`. A percentage is capped at
 * 99 so it can never price something at nothing; the save action refuses
 * anything larger before it gets here. */
export function applyDiscount(base: number, rule: DiscountRule): number {
  if (!hasDiscount(rule)) return base;
  if (rule.type === "percent") {
    return Math.max(1, Math.round(base * (1 - Math.min(rule.value, 99) / 100)));
  }
  return Math.max(0, base - rule.value);
}

/** Reads a stored price pair back into the rule that produced it.
 *
 * A percentage is preferred only when it round-trips exactly; otherwise a
 * "13%" that actually came from "৳199 off" would drift on every save.
 *
 * `others` are the combinations' own price pairs. "৳150 off ৳1000" is also an
 * exact 15%, and only a combination can tell the two apart: ৳1200 carrying
 * ৳150 off is ৳1050, where 15% would make it ৳1020. Reading that as a
 * percentage would detach the combination from the discount that priced it. */
export function readDiscount(
  price: number,
  oldPrice: number,
  others: { price: number | null; oldPrice: number | null }[] = []
): DiscountRule {
  if (!(oldPrice > 0 && oldPrice > price)) return NO_DISCOUNT;
  const off = oldPrice - price;
  const fixed: DiscountRule = { type: "fixed", value: off };
  const percentValue = Math.round((off / oldPrice) * 100);
  const percent: DiscountRule = { type: "percent", value: percentValue };
  if (Math.round(oldPrice * (1 - percentValue / 100)) !== price) return fixed;

  const onlyFixedFits = others.some(
    (pair) =>
      pair.price !== null &&
      pair.oldPrice !== null &&
      applyDiscount(pair.oldPrice, fixed) === pair.price &&
      applyDiscount(pair.oldPrice, percent) !== pair.price
  );
  return onlyFixedFits ? fixed : percent;
}
