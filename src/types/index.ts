import type { LucideIcon } from "lucide-react";

export interface Subcategory {
  id: string;
  name: string;
  image: string;
}

export interface Category {
  id: string;
  name: string;
  subtitle?: string;
  image: string;
  /** Tailwind-ready accent used by the category rail and hero strip. */
  accent?: string;
  /** Second level of the tree. Empty for categories that are not split up. */
  subcategories?: Subcategory[];
}

export interface ProductFeature {
  icon: LucideIcon;
  label: string;
}

export interface ProductColor {
  name: string;
  swatch: string;
}

export interface Product {
  id: string;
  name: string;
  image: string;
  /** Top-level category id from src/data/categories.ts. */
  categoryId: string;
  /** Subcategory id within that category, when the category has a second level. */
  subcategoryId?: string;
  rating: number;
  reviews: number;
  price: number;
  oldPrice: number;
  discountPercent: number;
  brand?: string;
  heroHeadline?: string;
  heroSubtitle?: string;
  bestSeller?: boolean;
  features?: ProductFeature[];
  colors?: ProductColor[];
}

export type ProductFilter =
  | "All"
  | "Men"
  | "Women"
  | "Electronics"
  | "Health & Beauty";

/** A home-page filter chip. `categoryIds` is empty for "All", which is how
 * the chip row says "no filter" without a special case at the call site. */
export interface ProductFilterOption {
  id: ProductFilter;
  categoryIds: string[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  points: number;
  /** Gates the seller dashboard and admin tooling. See src/lib/admin.ts. */
  role: UserRole;
  createdAt: string;
}

export interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  area: string | null;
  city: string;
  postalCode: string | null;
  isDefault: boolean;
}

export type PaymentMethodType = "card" | "bkash" | "nagad" | "cod";

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string;
  detail: string | null;
  isDefault: boolean;
}

/** Trimmed, serializable view of a Product for passing into Client Components -
 * the full Product carries lucide icon components (functions) in `features`,
 * which React cannot serialize across the server/client boundary. */
export interface ProductSummary {
  id: string;
  name: string;
  image: string;
  price: number;
  oldPrice: number;
  discountPercent: number;
  rating: number;
  reviews: number;
}

export interface CartItem {
  id: string;
  productId: string;
  color: string;
  quantity: number;
  product: ProductSummary;
}

export type DeliveryMethodId = "standard" | "express";

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  image: string;
  color: string | null;
  price: number;
  /** Pre-discount price, kept so the order can show the original price and savings. */
  oldPrice: number;
  quantity: number;
}

export interface OrderStep {
  status: OrderStatus;
  label: string;
  done: boolean;
  at: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currentStepLabel: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  pointsEarned: number;
  addressLabel: string;
  addressFullName: string;
  addressPhone: string;
  addressLine: string;
  addressArea: string | null;
  addressCity: string;
  paymentLabel: string;
  deliveryMethod: DeliveryMethodId;
  deliveryMethodName: string;
  deliveryEta: string;
  placedAt: string;
  estimatedDeliveryAt: string;
  steps: OrderStep[];
  items: OrderItem[];
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: "order" | "promo" | "system";
  orderId: string | null;
  isRead: boolean;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Marketplace catalog (database-backed)                                      */
/* -------------------------------------------------------------------------- */

/** Distinct from the presentational `Product` above, which is the static
 * catalog shape and carries lucide icon *components*. Database-backed
 * products carry icon *names* that the UI resolves to components. */
export type ProductStatus = "draft" | "pending_review" | "active" | "rejected" | "archived";

export type ProductSort = "newest" | "price_asc" | "price_desc" | "rating" | "popular";

export interface CatalogCategory {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  subtitle: string | null;
  image: string | null;
  icon: string | null;
  sortOrder: number;
}

export interface CatalogBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface CatalogVariant {
  id: string;
  productId: string;
  sku: string | null;
  optionName: string | null;
  optionValue: string | null;
  option2Name: string | null;
  option2Value: string | null;
  swatch: string | null;
  price: number;
  oldPrice: number;
  /** Resolved price: the variant's own price, or the product's when inherited. */
  effectivePrice: number;
  stockQuantity: number;
  /** Stock minus quantity reserved by pending orders. */
  availableQuantity: number;
  imageUrl: string | null;
  isActive: boolean;
}

export interface CatalogProduct {
  id: string;
  sellerId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  brand: string | null;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  heroHeadline: string | null;
  heroSubtitle: string | null;
  status: ProductStatus;
  price: number;
  oldPrice: number;
  discountPercent: number;
  currency: string;
  isFeatured: boolean;
  isBestSeller: boolean;
  rating: number;
  reviews: number;
  soldCount: number;
  viewCount: number;
  image: string | null;
  inStock: boolean;
  stockTotal: number;
  images: string[];
  variants: CatalogVariant[];
  features: { icon: string; label: string }[];
  attributes: { name: string; value: string }[];
}

/* -------------------------------------------------------------------------- */
/* Sellers, reviews, coupons                                                  */
/* -------------------------------------------------------------------------- */

export type SellerStatus = "pending" | "approved" | "suspended" | "rejected";

export interface Seller {
  id: string;
  userId: string;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  status: SellerStatus;
  commissionRate: number;
  rating: number;
  ratingCount: number;
  totalSales: number;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string | null;
  body: string | null;
  sellerReply: string | null;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  images: string[];
  createdAt: string;
}

export type CouponType = "percent" | "fixed" | "free_shipping";

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

export type UserRole = "customer" | "seller" | "admin" | "support";

/* -------------------------------------------------------------------------- */
/* Offers                                                                     */
/* -------------------------------------------------------------------------- */

/** A product inside the running flash sale. `claimed` is the share of the
 * allocation already sold, which is what drives the "% claimed" bar borrowed
 * from Amazon's Lightning Deals. */
export interface FlashSaleEntry {
  productId: string;
  salePrice: number;
  /** Units set aside for the sale. */
  stockLimit: number;
  soldCount: number;
}

export interface FlashSale {
  id: string;
  name: string;
  /** Minutes the sale runs for, measured from its slot start. Wall-clock
   * start/end are derived at request time so the demo catalog always has a
   * sale in flight instead of one that expired months ago. */
  durationMinutes: number;
  items: FlashSaleEntry[];
}

/** A flash-sale line resolved against the catalog and the clock. */
export interface FlashSaleItem {
  product: ProductSummary;
  salePrice: number;
  /** Taka off the normal selling price. */
  saving: number;
  stockLimit: number;
  soldCount: number;
  /** 0-100, rounded. */
  claimedPercent: number;
  soldOut: boolean;
}

export type OfferDealId = "flash" | "under1000" | "biggest" | "bestseller";

/** A voucher shown in the offers wallet. Mirrors the `coupons` table so a
 * seeded coupon and a hand-written one render identically. */
export interface OfferCoupon {
  code: string;
  title: string;
  description: string;
  discountType: CouponType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  /** Free-form validity line, e.g. "Ends in 3 days". */
  validity: string;
}

/* -------------------------------------------------------------------------- */
/* Wishlist                                                                   */
/* -------------------------------------------------------------------------- */

/** A saved product plus the signals shoppers actually decide on: whether the
 * price moved since they saved it, and whether it is on offer right now. */
export interface WishlistEntry {
  product: ProductSummary;
  /** Price at the moment it was saved. Null for rows saved before the column
   * existed, which simply show no price-drop badge. */
  savedPrice: number | null;
  /** Positive when the price fell since it was saved. */
  priceDrop: number;
  savedAt: string;
  categoryId: string;
  categoryName: string;
  /** Set when the product is in the running flash sale. */
  flashPrice: number | null;
  inCart: boolean;
}

export type WishlistSort = "recent" | "price_asc" | "price_desc" | "discount";
