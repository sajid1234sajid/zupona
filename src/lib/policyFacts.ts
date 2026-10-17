/** The figures the help and policy pages quote, read from where the shop
 * actually enforces them.
 *
 * A policy page that types "৳130" or "7 days" into its wording is a second
 * copy of a number that lives in Settings, and the two drift the first time
 * the admin changes one -- which is how the homepage came to promise free
 * delivery over ৳1,000 while checkout waived it at ৳999. These pages read the
 * delivery fee and threshold the checkout charges by, the delivery window the
 * checkout quotes, the return and exchange windows the product page shows, and
 * the payment methods the checkout will actually take. */

import { getShopSettings, DEFAULT_SETTINGS } from "@/lib/shopSettings";
import { acceptedPaymentProviders, type PaymentProvider } from "@/lib/payments";
import { DELIVERY_DAYS } from "@/lib/checkout";

export interface PolicyFacts {
  storeName: string;
  deliveryFee: number;
  /** 0 when free delivery is switched off. */
  freeShippingThreshold: number;
  deliveryDays: { min: number; max: number };
  /** 0 when the shop has not set a window. */
  returnDays: number;
  exchangeDays: number;
  /** Whether a seller's new product waits for an admin before going live. */
  sellerProductsReviewed: boolean;
  /** Labels of the payment methods checkout accepts today. */
  paymentMethods: string[];
}

export async function getPolicyFacts(): Promise<PolicyFacts> {
  const [settings, providers] = await Promise.all([
    getShopSettings().catch(() => DEFAULT_SETTINGS),
    acceptedPaymentProviders().catch(() => [] as PaymentProvider[]),
  ]);
  const paymentMethods = providers.map((provider) => provider.label);
  return {
    storeName: settings.storeName,
    deliveryFee: settings.deliveryFee,
    freeShippingThreshold: settings.freeShippingThreshold,
    deliveryDays: { min: DELIVERY_DAYS.min, max: DELIVERY_DAYS.max },
    returnDays: settings.returnDays,
    exchangeDays: settings.exchangeDays,
    sellerProductsReviewed: settings.sellerProductsNeedReview,
    // Cash on delivery is always taken; the list is never empty on a page.
    paymentMethods: paymentMethods.length > 0 ? paymentMethods : ["Cash on Delivery"],
  };
}

/** "Cash on Delivery, bKash and Nagad". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "3 days", "1 day". */
export function days(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}
