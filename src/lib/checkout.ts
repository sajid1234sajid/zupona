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
  eta: string;
  fee: number;
}

/** The delivery window as numbers, so the product page can promise actual
 * dates. The ETA text below is built from it so the two cannot differ. */
export const DELIVERY_DAYS = { min: 2, max: 3 } as const;

/** What delivery costs before the shop configures its own fee. */
export const DEFAULT_DELIVERY_FEE = 130;

/** The shop's one delivery option.
 *
 * There used to be a Standard/Express choice. The shop charges a single
 * delivery fee now, so there is nothing for the shopper to pick and the
 * option is shown rather than chosen. */
export const deliveryOption: DeliveryMethod = {
  id: "standard",
  name: "Home Delivery",
  tagline: "Safe & reliable delivery",
  eta: `${DELIVERY_DAYS.min}-${DELIVERY_DAYS.max} days`,
  fee: DEFAULT_DELIVERY_FEE,
};

/** Orders placed while Express still existed keep `express` in their record.
 * They are never re-priced -- the fee charged is stored on the order itself --
 * but their own label is kept so an old order does not read as something the
 * shopper did not choose. */
const legacyExpress: DeliveryMethod = {
  id: "express",
  name: "Express Delivery",
  tagline: "Faster delivery for urgent orders",
  eta: "24 hours",
  fee: 120,
};

/** The delivery option behind a stored `delivery_method`, optionally priced
 * with the shop's configured fee. Applied here rather than at each call site
 * so cart, checkout and the order record can never disagree. */
export function getDeliveryMethod(id: string, fee?: number): DeliveryMethod {
  const method = id === "express" ? legacyExpress : deliveryOption;
  return fee === undefined ? method : { ...method, fee };
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
