/** The catalog-row-to-card narrowing, kept free of any database import so
 * the browser can use it: a client component that imported it from
 * `@/lib/categories` pulled that module's D1 access into the bundle, and the
 * page failed to load. */

import type { StoreProductCard } from "@/lib/storefront";
import type { ProductSummary } from "@/types";

/** Trims a catalog row to the shape client components receive. The database
 * row already carries only serializable values, so this is a narrowing rather
 * than the icon-stripping it used to be. */
export function toSummary(product: StoreProductCard): ProductSummary {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    image: product.image,
    price: product.price,
    oldPrice: product.oldPrice,
    discountPercent: product.discountPercent,
    rating: product.rating,
    reviews: product.reviews,
    soldCount: product.soldCount,
    stockLeft: product.stockLeft,
    freeDelivery: product.freeDelivery,
    badgeLabel: product.badgeLabel,
    bestSeller: product.bestSeller,
    brand: product.brand,
    hasOptions: product.hasOptions,
    hasVideo: product.hasVideo,
    rank: product.rank ?? null,
  };
}
