/** Store configuration, read from the `site_settings` table.
 *
 * These are the values the admin Settings page writes. Everything here has a
 * default, so the shop works exactly as before on a database where nothing has
 * been configured yet -- the settings only ever *override*.
 *
 * Server-only: it touches D1. Client components receive the values they need
 * as props from the page that renders them. */

import { getDB } from "@/lib/db";
import { cached } from "@/lib/cache";

export interface ShopSettings {
  storeName: string;
  storeTagline: string;
  supportEmail: string | null;
  supportPhone: string | null;
  currencySymbol: string;
  standardShippingFee: number;
  expressShippingFee: number;
  /** 0 disables free shipping entirely. */
  freeShippingThreshold: number;
  lowStockThreshold: number;
  reviewsNeedApproval: boolean;
  /** Days a shopper has to return an item. 0 hides the line on product pages. */
  returnDays: number;
  /** Days a shopper has to exchange an item. 0 hides the line on product pages. */
  exchangeDays: number;
  guestCheckoutEnabled: boolean;
  maintenanceMode: boolean;
  /** Echoes the one-time code back to the browser so checkout can be tested
   * without an SMS gateway. Off by default: with it on, anyone can request a
   * code for any number and read it out of the response, which is enough to
   * sign in as that person. Only turn it on against a throwaway database. */
  otpDemoMode: boolean;
}

/** What the storefront falls back to. These match the values that used to be
 * hardcoded, so nothing changes until an admin edits a setting. */
export const DEFAULT_SETTINGS: ShopSettings = {
  storeName: "Zupona",
  storeTagline: "Bangladesh's trusted online shop",
  supportEmail: null,
  supportPhone: null,
  currencySymbol: "৳",
  standardShippingFee: 80,
  expressShippingFee: 120,
  freeShippingThreshold: 999,
  lowStockThreshold: 5,
  reviewsNeedApproval: false,
  // Zero until the shop states a policy, so no product promises one it has not made.
  returnDays: 0,
  exchangeDays: 0,
  guestCheckoutEnabled: true,
  maintenanceMode: false,
  otpDemoMode: false,
};

function readInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return raw === "1";
}

async function querySettings(): Promise<ShopSettings> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT key, value FROM site_settings")
    .all<{ key: string; value: string }>();

  const map = new Map(results.map((row) => [row.key, row.value]));
  const text = (key: string, fallback: string) => map.get(key)?.trim() || fallback;

  return {
    storeName: text("store_name", DEFAULT_SETTINGS.storeName),
    storeTagline: text("store_tagline", DEFAULT_SETTINGS.storeTagline),
    supportEmail: map.get("support_email")?.trim() || null,
    supportPhone: map.get("support_phone")?.trim() || null,
    currencySymbol: text("currency_symbol", DEFAULT_SETTINGS.currencySymbol),
    standardShippingFee: readInt(
      map.get("standard_shipping_fee"),
      DEFAULT_SETTINGS.standardShippingFee
    ),
    expressShippingFee: readInt(
      map.get("express_shipping_fee"),
      DEFAULT_SETTINGS.expressShippingFee
    ),
    freeShippingThreshold: readInt(
      map.get("free_shipping_threshold"),
      DEFAULT_SETTINGS.freeShippingThreshold
    ),
    lowStockThreshold: readInt(map.get("low_stock_threshold"), DEFAULT_SETTINGS.lowStockThreshold),
    reviewsNeedApproval: readFlag(
      map.get("reviews_need_approval"),
      DEFAULT_SETTINGS.reviewsNeedApproval
    ),
    returnDays: readInt(map.get("return_days"), DEFAULT_SETTINGS.returnDays),
    exchangeDays: readInt(map.get("exchange_days"), DEFAULT_SETTINGS.exchangeDays),
    guestCheckoutEnabled: readFlag(
      map.get("guest_checkout_enabled"),
      DEFAULT_SETTINGS.guestCheckoutEnabled
    ),
    maintenanceMode: readFlag(map.get("maintenance_mode"), DEFAULT_SETTINGS.maintenanceMode),
    otpDemoMode: readFlag(map.get("otp_demo_mode"), DEFAULT_SETTINGS.otpDemoMode),
  };
}

/** Cached briefly and cleared by the Settings page on save, so a changed
 * delivery fee takes effect on the next page load rather than on a deploy. */
export async function getShopSettings(): Promise<ShopSettings> {
  return cached("settings:all", querySettings, 30);
}

/* -------------------------------------------------------------------------- */
/* Derived helpers                                                            */
/* -------------------------------------------------------------------------- */

export interface DeliveryFees {
  standard: number;
  express: number;
}

export async function getDeliveryFees(): Promise<DeliveryFees> {
  const settings = await getShopSettings();
  return { standard: settings.standardShippingFee, express: settings.expressShippingFee };
}

/** The delivery charge for an order, after the free-shipping threshold.
 *
 * One place decides this so the cart, the checkout summary and the order
 * total can never quote three different numbers. */
export function shippingFeeFor(
  subtotal: number,
  method: "standard" | "express",
  settings: Pick<
    ShopSettings,
    "standardShippingFee" | "expressShippingFee" | "freeShippingThreshold"
  >
): number {
  const base =
    method === "express" ? settings.expressShippingFee : settings.standardShippingFee;

  // A threshold of 0 means the shop is not offering free delivery at all.
  if (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold) {
    return 0;
  }
  return base;
}
