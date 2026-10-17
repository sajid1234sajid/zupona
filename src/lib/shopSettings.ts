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
  /** A product card says "84 sold" once a product has sold at least this
   * many; 0 keeps the figure off cards. The product page is not affected. */
  cardSoldMin: number;
  reviewsNeedApproval: boolean;
  /** Whether a seller's new product waits for an admin's approval before it
   * goes live. On by default: a marketplace that lets any approved shop put
   * anything on the storefront unseen is one bad listing away from a problem
   * the platform answers for. */
  sellerProductsNeedReview: boolean;
  /** What one point is worth in Taka when redeemed. */
  pointValue: number;
  /** Points can pay at most this percent of an order's items. */
  pointsMaxPercent: number;
  /** The fewest points that can be redeemed at once. */
  pointsMinRedeem: number;
  /** Points for a published review with at least 20 characters of text. 0
   * gives none, and then no review is labelled as rewarded. */
  reviewPoints: number;
  /** Extra points when the review has a photo. */
  reviewPhotoPoints: number;
  /** Days a shopper has to return an item. 0 hides the line on product pages. */
  returnDays: number;
  /** The size table the product page's size guide shows; see `src/lib/sizeGuide.ts`.
   * Empty hides the size guide link. */
  sizeGuide: string;
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
  /** Google Analytics 4 measurement id ("G-XXXXXXX"); null keeps GA4 off. */
  ga4MeasurementId: string | null;
  /** Where errors are reported (a Sentry DSN); null keeps reporting off. */
  sentryDsn: string | null;

  /** Whether a phone visitor is offered the "Get the Zupona app" strip above
   * the header. On by default: the shop is already installable, and the strip
   * is how a shopper finds that out. */
  appBannerEnabled: boolean;
  /** Days the strip stays away after a shopper closes it with the cross. */
  appBannerSnoozeDays: number;

  /** The shop's own pages elsewhere, linked from the storefront footer. Each
   * is null until an admin pastes one in, and a null one draws no icon -- the
   * footer never links to a page the shop does not have. */
  social: SocialLinks;
}

export interface SocialLinks {
  facebook: string | null;
  instagram: string | null;
  youtube: string | null;
  tiktok: string | null;
  /** A WhatsApp number in `+8801…` form; the footer turns it into a wa.me link. */
  whatsapp: string | null;
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
  cardSoldMin: 5,
  reviewsNeedApproval: false,
  sellerProductsNeedReview: true,
  pointValue: 0.25,
  pointsMaxPercent: 20,
  pointsMinRedeem: 100,
  // Off until the owner decides what a review is worth.
  reviewPoints: 0,
  reviewPhotoPoints: 0,
  // Zero until the shop states a policy, so no product promises one it has not made.
  returnDays: 0,
  sizeGuide: "",
  exchangeDays: 0,
  guestCheckoutEnabled: true,
  maintenanceMode: false,
  otpDemoMode: false,
  smsSenderId: null,
  facebookPixelId: null,
  ga4MeasurementId: null,
  sentryDsn: null,
  appBannerEnabled: true,
  appBannerSnoozeDays: 7,
  social: { facebook: null, instagram: null, youtube: null, tiktok: null, whatsapp: null },
};

function readInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readDecimal(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseFloat(raw);
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
    cardSoldMin: readInt(map.get("card_sold_min"), DEFAULT_SETTINGS.cardSoldMin),
    reviewsNeedApproval: readFlag(
      map.get("reviews_need_approval"),
      DEFAULT_SETTINGS.reviewsNeedApproval
    ),
    sellerProductsNeedReview: readFlag(
      map.get("seller_products_need_review"),
      DEFAULT_SETTINGS.sellerProductsNeedReview
    ),
    pointValue: readDecimal(map.get("point_value"), DEFAULT_SETTINGS.pointValue),
    pointsMaxPercent: Math.min(100, readInt(map.get("points_max_percent"), DEFAULT_SETTINGS.pointsMaxPercent)),
    pointsMinRedeem: readInt(map.get("points_min_redeem"), DEFAULT_SETTINGS.pointsMinRedeem),
    reviewPoints: readInt(map.get("review_points"), DEFAULT_SETTINGS.reviewPoints),
    reviewPhotoPoints: readInt(map.get("review_photo_points"), DEFAULT_SETTINGS.reviewPhotoPoints),
    returnDays: readInt(map.get("return_days"), DEFAULT_SETTINGS.returnDays),
    sizeGuide: map.get("size_guide")?.trim() ?? "",
    exchangeDays: readInt(map.get("exchange_days"), DEFAULT_SETTINGS.exchangeDays),
    guestCheckoutEnabled: readFlag(
      map.get("guest_checkout_enabled"),
      DEFAULT_SETTINGS.guestCheckoutEnabled
    ),
    maintenanceMode: readFlag(map.get("maintenance_mode"), DEFAULT_SETTINGS.maintenanceMode),
    otpDemoMode: readFlag(map.get("otp_demo_mode"), DEFAULT_SETTINGS.otpDemoMode),
    smsSenderId: map.get("sms_sender_id")?.trim() || null,
    facebookPixelId: map.get("facebook_pixel_id")?.trim() || null,
    ga4MeasurementId: map.get("ga4_measurement_id")?.trim() || null,
    sentryDsn: map.get("sentry_dsn")?.trim() || null,
    appBannerEnabled: readFlag(map.get("app_banner_enabled"), DEFAULT_SETTINGS.appBannerEnabled),
    appBannerSnoozeDays: readInt(
      map.get("app_banner_snooze_days"),
      DEFAULT_SETTINGS.appBannerSnoozeDays
    ),
    social: {
      facebook: map.get("social_facebook")?.trim() || null,
      instagram: map.get("social_instagram")?.trim() || null,
      youtube: map.get("social_youtube")?.trim() || null,
      tiktok: map.get("social_tiktok")?.trim() || null,
      whatsapp: map.get("social_whatsapp")?.trim() || null,
    },
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
