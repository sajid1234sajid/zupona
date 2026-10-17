/** What search engines and link previews are told about a product.
 *
 * Two jobs: a clean meta description (the product text as the owner wrote it
 * is full of emoji, quote marks and line breaks, which Google shows as noise),
 * and the structured data that lets a result show the price, the stock and
 * the stars. Both are built from the same product the page renders, and the
 * shipping and return details from the same settings checkout uses. */

import type { StoreProduct } from "@/lib/storefront";
import type { PolicyFacts } from "@/lib/policyFacts";
import { SITE_URL } from "@/lib/shareCard";

const COD_LINE = "Cash on Delivery all over Bangladesh.";

/** Plain one-line text: markup, Markdown marks, emoji and decorative quotes
 * removed, whitespace collapsed. Bangla text survives untouched. */
export function plainText(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>|~]+/g, " ")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/["“”‘’«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cut on a word boundary to at most `max` characters, with an ellipsis when
 * anything was cut. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

/** At most 160 characters: the admin's SEO description when there is one,
 * else their short summary when there is one,
 * otherwise the start of the description, then the Cash on Delivery promise
 * that is the reason a shopper here clicks. */
export function productMetaDescription(product: StoreProduct): string {
  // What the admin wrote for search engines is used as written, only cleaned.
  if (product.metaDescription) return clip(plainText(product.metaDescription), 160);
  const source = plainText(product.shortDescription || product.description || "");
  const room = 160 - COD_LINE.length - 1;
  if (!source) return clip(`Buy ${product.name} on Zupona. ${COD_LINE}`, 160);
  const body = clip(source, room);
  return `${body}${/[.!?…।]$/.test(body) ? "" : "."} ${COD_LINE}`;
}

/** schema.org Product, with its offer, shipping, return policy, and the
 * rating only when there is one: an empty rating is an error to Google and a
 * "0 stars" to a shopper. */
export function productSchema(
  product: StoreProduct,
  facts: PolicyFacts,
  breakdown: { average: number; total: number },
  reviews: { userName: string; rating: number; body: string | null; createdAt: string }[],
  categoryName: string | null
) {
  const url = `${SITE_URL}/products/${product.slug}`;
  const absolute = (src: string) => (src.startsWith("http") ? src : `${SITE_URL}${src}`);
  const images = (product.media ?? [])
    .filter((item) => item.type === "image")
    .map((item) => absolute(item.url))
    .slice(0, 8);
  if (images.length === 0 && product.image) images.push(absolute(product.image));

  const variants = product.variants ?? [];
  const prices = variants.length ? variants.map((variant) => variant.price) : [product.price];
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const inStock = product.tracksInventory === false || product.stockTotal > 0;
  const availability = `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`;

  const shippingDetails = {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: product.freeDelivery ? 0 : facts.deliveryFee,
      currency: "BDT",
    },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "BD" },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: facts.deliveryDays.min,
        maxValue: facts.deliveryDays.max,
        unitCode: "DAY",
      },
    },
  };

  const returnPolicy =
    facts.returnDays > 0
      ? {
          "@type": "MerchantReturnPolicy",
          applicableCountry: "BD",
          returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: facts.returnDays,
          returnMethod: "https://schema.org/ReturnByMail",
          url: `${SITE_URL}/returns-policy`,
        }
      : undefined;

  const offerBase = {
    priceCurrency: "BDT",
    availability,
    itemCondition: "https://schema.org/NewCondition",
    url,
    shippingDetails,
    ...(returnPolicy ? { hasMerchantReturnPolicy: returnPolicy } : {}),
  };

  const offers =
    low === high
      ? { "@type": "Offer", price: low, ...offerBase }
      : { "@type": "AggregateOffer", lowPrice: low, highPrice: high, offerCount: variants.length, ...offerBase };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    url,
    sku: product.id,
    image: images,
    description: plainText(product.description || product.shortDescription || product.name).slice(0, 5000),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(categoryName ? { category: categoryName } : {}),
    offers,
    ...(breakdown.total >= 1
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: breakdown.average,
            reviewCount: breakdown.total,
            bestRating: 5,
            worstRating: 1,
          },
          review: reviews.slice(0, 5).map((review) => ({
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5 },
            author: { "@type": "Person", name: review.userName || "Zupona customer" },
            datePublished: review.createdAt.slice(0, 10),
            ...(review.body ? { reviewBody: plainText(review.body).slice(0, 1000) } : {}),
          })),
        }
      : {}),
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path}`,
    })),
  };
}
