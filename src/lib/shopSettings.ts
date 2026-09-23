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
import { DEFAULT_DELIVERY_FEE, DEFAULT_FREE_DELIVERY_THRESHOLD } from "@/lib/checkout";

export interface ShopSettings {
  storeName: string;
  storeTagline: string;
  supportEmail: string | null;
  supportPhone: string | null;
  currencySymbol: string;
  /** What delivery costs. One fee: the shop does not offer delivery tiers. */
  deliveryFee: number;
  /** 0 disables free shipping entirely. */
  freeShippingThreshold: number;
  lowStockThreshold: number;
  /** Whether a shopper sees how many units are left, or only whether the item
   * can be bought at all. Off by default: the count is the shop's own figure,
   * and an admin turns it on deliberately when they want it shown. */
  showStockToShoppers: boolean;
  reviewsNeedApproval: boolean;
  /** Days a shopper has to return an item. 0 hides the line on product pages. */
  returnDays: number;
  /** Days a shopper has to exchange an item. 0 hides the line on product pages. */
  exchangeDays: number;
  guestCheckoutEnabled: boolean;
  maintenanceMode: boolean;
  /** Echoes the one-time code back to the browser instead of sending it, so
   * checkout can be tested without a gateway. Off by default: with it on,
   * anyone can request a code for any number and read it out of the response,
   * which is enough to order as that person. Only turn it on against a
   * throwaway database. */
  otpDemoMode: boolean;
  /** The sender mask the SMS gateway has approved for this shop, printed on
   * every message that arrives. Null means the gateway's default route, which
   * is what sms.net.bd uses for non-masked traffic. The API key behind it is a
   * Worker secret and is never a setting. */
  smsSenderId: string | null;

  /** The Meta (Facebook) pixel dataset id, pasted in from Events Manager.
   * Null means no pixel: nothing loads and no event is sent, which is the
   * state every shop starts in. The id is public by nature -- it appears in
   * the page source of every site that has one -- so unlike the access token
   * behind it, it travels with the rest of the settings. */
  facebookPixelId: string | null;
}

/** What the storefront falls back to. These match the values that used to be
 * hardcoded, so nothing changes until an admin edits a setting. */
export const DEFAULT_SETTINGS: ShopSettings = {
  storeName: "Zupona",
  storeTagline: "Bangladesh's trusted online shop",
  supportEmail: null,
  supportPhone: null,
  currencySymbol: "৳",
  deliveryFee: DEFAULT_DELIVERY_FEE,
  freeShippingThreshold: DEFAULT_FREE_DELIVERY_THRESHOLD,
  lowStockThreshold: 5,
  showStockToShoppers: false,
  reviewsNeedApproval: false,
  // Zero until the shop states a policy, so no product promises one it has not made.
  returnDays: 0,
  exchangeDays: 0,
  guestCheckoutEnabled: true,
  maintenanceMode: false,
  otpDemoMode: false,
  smsSenderId: null,
  facebookPixelId: null,
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
    deliveryFee: readInt(map.get("delivery_fee"), DEFAULT_SETTINGS.deliveryFee),
    freeShippingThreshold: readInt(
      map.get("free_shipping_threshold"),
      DEFAULT_SETTINGS.freeShippingThreshold
    ),
    lowStockThreshold: readInt(map.get("low_stock_threshold"), DEFAULT_SETTINGS.lowStockThreshold),
    showStockToShoppers: readFlag(
      map.get("show_stock_to_shoppers"),
      DEFAULT_SETTINGS.showStockToShoppers
    ),
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
    smsSenderId: map.get("sms_sender_id")?.trim() || null,
    facebookPixelId: map.get("facebook_pixel_id")?.trim() || null,
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

/* `ShopSettings` already carries `deliveryFee` and `freeShippingThreshold`, so
 * it satisfies `DeliveryPricing` as-is: every caller hands the settings object
 * straight to `resolveDelivery` rather than re-deriving the rule locally. */
