import type { DeliveryMethodId } from "@/types";

/** Shared, dependency-free checkout constants and helpers. Kept free of
 * `next/headers` and database imports so Client Components can import it -
 * the server-only verification half lives in `@/lib/verification`. */

export const CODE_LENGTH = 6;
export const CODE_TTL_SECONDS = 5 * 60; // matches the "Resend code in 05:00" timer

/* -------------------------------------------------------------------------- */
/* Phone numbers                                                              */
/* -------------------------------------------------------------------------- */

/** Turns any of `01712345678`, `+8801712345678`, `8801712345678` into `+8801712345678`. */
export function normalizeBdPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let local: string;

  if (digits.length === 11 && digits.startsWith("01")) local = digits;
  else if (digits.length === 13 && digits.startsWith("8801")) local = digits.slice(2);
  else if (digits.length === 10 && digits.startsWith("1")) local = `0${digits}`;
  else return null;

  // Bangladeshi mobile operators all sit in the 013-019 range.
  if (!/^01[3-9]\d{8}$/.test(local)) return null;
  return `+88${local}`;
}

/** `+8801712345678` -> `+880 1712 345678` (the format used across the checkout UI). */
export function formatBdPhone(phone: string): string {
  const match = /^\+880(\d{4})(\d{6})$/.exec(phone);
  if (!match) return phone;
  return `+880 ${match[1]} ${match[2]}`;
}

/* -------------------------------------------------------------------------- */
/* Delivery + payment options                                                 */
/* -------------------------------------------------------------------------- */

export interface DeliveryMethod {
  id: DeliveryMethodId;
  name: string;
  tagline: string;
  /** How long it takes. Both options travel the same way, so both say so. */
  eta: string;
  /** What this option costs on *this* order. */
  fee: number;
  /** True when the order is too small to earn free delivery. A locked option
   * is shown and cannot be chosen -- it tells the shopper what is on offer. */
  locked: boolean;
  /** The chip under the name: the ETA, the saving, or what unlocks it. */
  badge: string;
}

/** The delivery window as numbers, so the product page can promise actual
 * dates. The ETA text below is built from it so the two cannot differ. */
export const DELIVERY_DAYS = { min: 2, max: 3 } as const;

/** What delivery costs, and what an order must reach to earn it free, before
 * the shop configures its own. Both are editable on the admin Settings page. */
export const DEFAULT_DELIVERY_FEE = 130;
export const DEFAULT_FREE_DELIVERY_THRESHOLD = 999;

/** The two settings every delivery decision is made from. Taking them as a
 * plain object rather than the whole `ShopSettings` is what lets this file
 * stay free of server-only imports and be used by the wizard as well. */
export interface DeliveryPricing {
  /** The paid option's fee. */
  deliveryFee: number;
  /** Subtotal at which free delivery unlocks. 0 switches it off entirely. */
  freeShippingThreshold: number;
}

/** Whether this order has earned free delivery.
 *
 * At the threshold exactly, it has: `>=`, not `>`. A threshold of 0 means the
 * shop is not offering free delivery, so nothing unlocks it. This one function
 * decides it for the wizard and for `placeOrder` both, which is what stops a
 * hand-made request from buying below the threshold and paying nothing. */
export function freeDeliveryUnlocked(subtotal: number, pricing: DeliveryPricing): boolean {
  return pricing.freeShippingThreshold > 0 && subtotal >= pricing.freeShippingThreshold;
}

/** Both options as this order sees them: priced, and with free delivery locked
 * when the subtotal has not reached the threshold. Home delivery is always
 * first, always unlocked, and is what the wizard starts on. */
export function deliveryOptionsFor(subtotal: number, pricing: DeliveryPricing): DeliveryMethod[] {
  const unlocked = freeDeliveryUnlocked(subtotal, pricing);
  return [
    {
      id: "home",
      name: "Home Delivery",
      tagline: "Safe & reliable delivery to your doorstep",
      eta: `${DELIVERY_DAYS.min}-${DELIVERY_DAYS.max} days`,
      fee: pricing.deliveryFee,
      locked: false,
      badge: `${DELIVERY_DAYS.min}-${DELIVERY_DAYS.max} days`,
    },
    {
      id: "free",
      name: "Free Home Delivery",
      tagline: `Get free delivery on orders ${formatThreshold(pricing)} or above`,
      eta: `${DELIVERY_DAYS.min}-${DELIVERY_DAYS.max} days`,
      fee: 0,
      locked: !unlocked,
      badge: unlocked
        ? `Save ৳${pricing.deliveryFee}`
        : `Free on orders ${formatThreshold(pricing)}+`,
    },
  ];
}

function formatThreshold(pricing: DeliveryPricing): string {
  return `৳${pricing.freeShippingThreshold}`;
}

/** The option an order is actually placed with, and the fee it carries.
 *
 * A request for free delivery on an order below the threshold is not an error
 * to report -- it is simply not honoured, and falls back to home delivery at
 * the full fee. The wizard calls this so its radio cannot show a selection the
 * order would not get, and `placeOrder` calls it so the fee it writes is
 * decided on the server whatever the browser asked for. */
export function resolveDelivery(
  requested: string | undefined,
  subtotal: number,
  pricing: DeliveryPricing
): DeliveryMethod {
  const options = deliveryOptionsFor(subtotal, pricing);
  const wanted = options.find((option) => option.id === requested && !option.locked);
  return wanted ?? options[0];
}

/** Orders placed under the old Standard/Express delivery keep those ids. They
 * are never re-priced -- the fee charged is stored on the order itself -- but
 * their own label is kept, so an old order does not read as something the
 * shopper did not choose. */
const legacyNames: Record<string, string> = {
  standard: "Standard Delivery",
  express: "Express Delivery",
};

/** The label for a stored `delivery_method`, for showing an order back. */
export function deliveryMethodName(id: string): string {
  if (legacyNames[id]) return legacyNames[id];
  return id === "free" ? "Free Home Delivery" : "Home Delivery";
}

/** The shape the wizard carries from the address step into placing the order. */
export interface DeliveryDetails {
  fullName: string;
  phone: string;
  division: string;
  /** The district. Bangladesh addresses go division -> district -> upazila, and
   * leaving this level out is what made most of the country unreachable. */
  district: string;
  /** The upazila or thana inside the district. */
  area: string;
  addressDetails: string;
  /** Which option the shopper picked. Only honoured when it is allowed on this
   * order -- `resolveDelivery` has the last word on both sides. */
  deliveryMethod: DeliveryMethodId;
}

export type PaymentMethodId = "cod" | "online" | "bank";

export interface PaymentOption {
  id: PaymentMethodId;
  name: string;
  tagline: string;
  note?: string;
  badge?: string;
  /** False until the gateway behind it has real credentials. An unconfigured
   * method is shown, so the shopper knows it is coming, but cannot be chosen:
   * offering a button that cannot take money is worse than not offering it. */
  available?: boolean;
}

export const paymentOptions: PaymentOption[] = [
  {
    id: "cod",
    name: "Cash on Delivery",
    tagline: "Pay when your order arrives",
    note: "Pay when you receive",
    badge: "Most Popular",
  },
  {
    id: "online",
    name: "Online Payment",
    tagline: "Pay securely with card, bKash, Nagad or other wallets",
  },
  {
    id: "bank",
    name: "Bank Transfer",
    tagline: "Transfer money directly from your bank",
    note: "All major banks supported",
  },
];

export function getPaymentOption(id: string): PaymentOption {
  return paymentOptions.find((option) => option.id === id) ?? paymentOptions[0];
}
