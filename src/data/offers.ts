import type { FlashSale, OfferCoupon } from "@/types";

/** The offers hub's editorial content.
 *
 * Two conventions borrowed from Amazon's Lightning Deals and Daraz's Flash
 * Sale, because both are what shoppers already expect from a deals page:
 *
 * 1. A hard time window with a live countdown, so the offer is obviously
 *    perishable.
 * 2. A "% claimed" bar per item, so scarcity is visible before the tap
 *    rather than at checkout.
 *
 * The sale is defined as a *duration* rather than fixed timestamps. Wall-clock
 * start and end are derived per request in `src/lib/offers.ts`, which keeps a
 * live sale on screen instead of one that quietly expired — a fixed date in a
 * seeded catalog is the usual reason a demo deals page looks broken.
 */
export const flashSale: FlashSale = {
  id: "flash-daily",
  name: "Flash Sale",
  durationMinutes: 6 * 60,
  items: [
    { productId: "smart-watch-7", salePrice: 2299, stockLimit: 120, soldCount: 104 },
    { productId: "wireless-headphones", salePrice: 1449, stockLimit: 200, soldCount: 176 },
    { productId: "fast-power-bank", salePrice: 1699, stockLimit: 150, soldCount: 138 },
    { productId: "matte-lipstick-set", salePrice: 749, stockLimit: 300, soldCount: 201 },
    { productId: "gold-plated-bangle-set", salePrice: 799, stockLimit: 100, soldCount: 100 },
    { productId: "mens-embroidered-panjabi", salePrice: 1749, stockLimit: 80, soldCount: 41 },
    { productId: "laptop-backpack", salePrice: 1149, stockLimit: 90, soldCount: 62 },
    { productId: "jamdani-cotton-saree", salePrice: 2799, stockLimit: 40, soldCount: 27 },
  ],
};

/** Vouchers shown in the offers wallet.
 *
 * These mirror the `coupons` table column for column, so a code seeded into
 * D1 and one written here render through the same card. `code` is what the
 * shopper pastes into the cart, and it is checked there by
 * `validateCoupon()` — collecting a coupon here never grants a discount on
 * its own. */
export const offerCoupons: OfferCoupon[] = [
  {
    code: "ZUPONA100",
    title: "৳100 off your order",
    description: "On orders over ৳999. One use per account.",
    discountType: "fixed",
    discountValue: 100,
    minOrderAmount: 999,
    maxDiscountAmount: null,
    validity: "Ends in 3 days",
  },
  {
    code: "NEW15",
    title: "15% off for new shoppers",
    description: "First order only, up to ৳300 off.",
    discountType: "percent",
    discountValue: 15,
    minOrderAmount: 500,
    maxDiscountAmount: 300,
    validity: "Ongoing",
  },
  {
    code: "FREEDROP",
    title: "Free delivery",
    description: "Delivery charge waived on orders over ৳1,499.",
    discountType: "free_shipping",
    discountValue: 0,
    minOrderAmount: 1499,
    maxDiscountAmount: null,
    validity: "Ends this week",
  },
  {
    code: "BEAUTY20",
    title: "20% off Health & Beauty",
    description: "Skin, hair and wellness picks, up to ৳400 off.",
    discountType: "percent",
    discountValue: 20,
    minOrderAmount: 800,
    maxDiscountAmount: 400,
    validity: "Ends in 5 days",
  },
];

/** Order value above which standard delivery is free. Shown as a progress
 * meter on the offers page for signed-in shoppers with something in the cart. */
export const FREE_DELIVERY_THRESHOLD = 999;
