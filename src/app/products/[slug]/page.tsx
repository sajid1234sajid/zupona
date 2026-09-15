import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductHeader from "@/components/layout/ProductHeader";
import BottomNav from "@/components/layout/BottomNav";
import StoreShell, { StoreContainer } from "@/components/layout/StoreShell";
import ProductView from "@/components/product/dynamic/ProductView";
import ProductDescription from "@/components/product/dynamic/ProductDescription";
import ProductReviews from "@/components/product/dynamic/ProductReviews";
import SimilarProducts from "@/components/product/dynamic/SimilarProducts";
import type { DeliveryLine } from "@/components/product/dynamic/PurchaseInfo";
import { getStoreProductBySlug, getStoreCategory, listStoreProducts } from "@/lib/storefront";
import { getShopSettings } from "@/lib/shopSettings";
import { STANDARD_DELIVERY_DAYS, deliveryMethodsWithFees } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";
import { getRatingBreakdown, getReviewableLines, listReviews } from "@/lib/reviews";

/** The dynamic product page.
 *
 * One page for the whole catalogue. Which selectors appear, whether there is a
 * video, what the trust strip says -- all of it comes from the product, so a
 * category invented tomorrow needs no code. The old /product/[id] address
 * forwards here. */

/** Reviews loaded with the page; the list shows the first few of these. */
const REVIEW_LIMIT = 50;
const SIMILAR_LIMIT = 12;

/** The standard delivery window as dates in Bangladesh, e.g. "18–19 September"
 * or "30 Sep – 2 Oct" across a month end. */
function estimatedDeliveryRange(now = new Date()): string {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const from = new Date(now.getTime() + STANDARD_DELIVERY_DAYS.min * DAY_MS);
  const to = new Date(now.getTime() + STANDARD_DELIVERY_DAYS.max * DAY_MS);
  const part = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", ...options }).format(date);

  const sameMonth = part(from, { month: "long" }) === part(to, { month: "long" });
  return sameMonth
    ? `${part(from, { day: "numeric" })}–${part(to, { day: "numeric", month: "long" })}`
    : `${part(from, { day: "numeric", month: "short" })} – ${part(to, { day: "numeric", month: "short" })}`;
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStoreProductBySlug(slug);
  if (!product) return { title: "Product not found — Zupona" };

  return {
    title: `${product.name} — Zupona`,
    description:
      product.shortDescription ??
      product.description?.slice(0, 155) ??
      `Buy ${product.name} on Zupona with fast delivery across Bangladesh.`,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.shortDescription ?? undefined,
      images: product.media?.[0] ? [product.media[0].url] : undefined,
      type: "website",
    },
  };
}

export default async function DynamicProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;

  const [product, user, settings] = await Promise.all([
    getStoreProductBySlug(slug),
    getCurrentUser(),
    getShopSettings(),
  ]);

  // Covers both "never existed" and "unpublished in the admin panel", which
  // should look the same to a shopper.
  if (!product) notFound();

  const [wishlistIds, department, breakdown, reviews, reviewableLines, related] = await Promise.all([
    getWishlistProductIds(user?.id ?? null),
    product.categoryId ? getStoreCategory(product.categoryId) : Promise.resolve(undefined),
    getRatingBreakdown(product.id),
    listReviews(product.id, { limit: REVIEW_LIMIT }),
    user ? getReviewableLines(user.id, product.id) : Promise.resolve([]),
    product.categoryId
      ? listStoreProducts({ categoryId: product.categoryId, sort: "popular", limit: SIMILAR_LIMIT + 1 })
      : Promise.resolve([]),
  ]);

  const similar = related.filter((entry) => entry.id !== product.id).slice(0, SIMILAR_LIMIT);

  const breadcrumbs = [
    "Home",
    department?.name,
    department?.subcategories.find((entry) => entry.id === product.subcategoryId)?.name,
  ].filter(Boolean) as string[];

  // The shop's own configured fees, so what a product promises is what
  // checkout charges.
  const deliveryLines: DeliveryLine[] = deliveryMethodsWithFees({
    standard: settings.standardShippingFee,
    express: settings.expressShippingFee,
  }).map((method) => ({
    label: method.name,
    value: `${method.eta} · ${formatPrice(method.fee)}`,
  }));

  return (
    <StoreShell withStickyActions>
      <ProductHeader />
      <main className="flex-1">
        <StoreContainer className="py-4">
          <ProductView
            product={product}
            breadcrumbs={breadcrumbs}
            deliveryLines={deliveryLines}
            returnDays={settings.returnDays}
            exchangeDays={settings.exchangeDays}
            estimatedDelivery={estimatedDeliveryRange()}
            reviewSummary={{ average: breakdown.average, total: breakdown.total }}
            hasSimilar={similar.length > 0}
            initiallyWishlisted={wishlistIds.has(product.id)}
          />

          <div className="mt-4 space-y-4 tab:mt-8">
            <ProductDescription description={product.description} attributes={product.attributes ?? []} />
            <ProductReviews
              productId={product.id}
              breakdown={breakdown}
              reviews={reviews}
              reviewableLines={reviewableLines}
            />
            <SimilarProducts
              products={similar}
              wishlistIds={[...wishlistIds]}
              isSignedIn={Boolean(user)}
            />
          </div>
        </StoreContainer>
      </main>
      {/* The tab bar is a phone affordance; above 700px the page has room for
          real navigation and the buy buttons sit beside the product instead. */}
      <div className="tab:hidden">
        <BottomNav />
      </div>
    </StoreShell>
  );
}
