import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import ProductHeader from "@/components/layout/ProductHeader";
import DesktopHeader from "@/components/layout/DesktopHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import StoreShell, { StoreContainer } from "@/components/layout/StoreShell";
import ProductView from "@/components/product/dynamic/ProductView";
import ProductDescription from "@/components/product/dynamic/ProductDescription";
import ProductReviews from "@/components/product/dynamic/ProductReviews";
import SimilarProducts from "@/components/product/dynamic/SimilarProducts";
import type { DeliveryLine } from "@/components/product/dynamic/PurchaseInfo";
import { getStoreProductBySlug, getStoreCategory, listStoreProducts } from "@/lib/storefront";
import { getShopSettings } from "@/lib/shopSettings";
import { shareMetadata } from "@/lib/shareCard";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbSchema, productMetaDescription, productSchema } from "@/lib/seo";
import { getPolicyFacts } from "@/lib/policyFacts";
import PixelEvent from "@/components/analytics/PixelEvent";
import RecordView from "@/components/product/RecordView";
import { DELIVERY_DAYS, deliveryOptionsFor } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";
import { getRatingBreakdown, getReviewableLines, listReviews } from "@/lib/reviews";
import { bestSellerRanks } from "@/lib/bestSellers";
import { getSupportContact } from "@/lib/contact";
import { parseSizeGuide } from "@/lib/sizeGuide";
import { getProductSeller } from "@/lib/productSeller";
import { toSummary } from "@/lib/summary";
import { SITE_URL } from "@/lib/shareCard";
import { productRedirect } from "@/lib/productRedirects";
import ProductPromises from "@/components/product/ProductPromises";
import SellerLine from "@/components/product/SellerLine";
import PagedProductGrid from "@/components/product/PagedProductGrid";
import MountWhenNear from "@/components/ui/MountWhenNear";

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
  const from = new Date(now.getTime() + DELIVERY_DAYS.min * DAY_MS);
  const to = new Date(now.getTime() + DELIVERY_DAYS.max * DAY_MS);
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

  // Cleaned of emoji, quote marks and Markdown, cut on a word, and closed
  // with the Cash on Delivery promise; the page itself shows the text as the
  // owner wrote it.
  const description = productMetaDescription(product);
  const path = `/products/${product.slug}`;

  return {
    // The price in the title: on a results page it is what a shopper here
    // decides on before they click.
    title: `${product.name} – ৳${product.price.toLocaleString("en-US")} | Zupona`,
    description,
    // Any ?color= or tracking parameters fold into the one product address.
    alternates: { canonical: path },
    // `poster`, not `url`: the first item can be a video, and a preview needs
    // a still. Every item carries one.
    ...shareMetadata({
      title: product.name,
      description,
      path,
      image: product.media?.[0]?.poster,
      imageAlt: product.media?.[0]?.alt,
      product: true,
    }),
  };
}

/** How many products "More to explore" carries under the page. */
const EXPLORE_LIMIT = 40;

export default async function DynamicProductPage({ params, searchParams }: PageProps<"/products/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  // `?color=grey&size=m` opens the page on that choice.
  const requested = Object.fromEntries(
    Object.entries(query).flatMap(([key, value]) => {
      const first = Array.isArray(value) ? value[0] : value;
      return first && /^[a-z]{1,20}$/.test(key) ? [[key, first.slice(0, 60)]] : [];
    })
  );

  const [product, user, settings] = await Promise.all([
    getStoreProductBySlug(slug),
    getCurrentUser(),
    getShopSettings(),
  ]);

  // Covers both "never existed" and "unpublished in the admin panel", which
  // should look the same to a shopper -- unless the listing was merged into
  // another, whose page it now opens (with the same colour chosen).
  if (!product) {
    const moved = await productRedirect({ slug });
    if (moved) permanentRedirect(moved);
    notFound();
  }

  const [wishlistIds, department, breakdown, reviews, reviewableLines, related, facts, ranks, contact, seller, popular] = await Promise.all([
    getWishlistProductIds(user?.id ?? null),
    product.categoryId ? getStoreCategory(product.categoryId) : Promise.resolve(undefined),
    getRatingBreakdown(product.id),
    listReviews(product.id, { limit: REVIEW_LIMIT }),
    user ? getReviewableLines(user.id, product.id) : Promise.resolve([]),
    product.categoryId
      ? listStoreProducts({ categoryId: product.categoryId, sort: "popular", limit: SIMILAR_LIMIT + 1 })
      : Promise.resolve([]),
    getPolicyFacts(),
    bestSellerRanks().catch(() => ({}) as Awaited<ReturnType<typeof bestSellerRanks>>),
    getSupportContact(),
    getProductSeller(product.id).catch(() => null),
    listStoreProducts({ sort: "popular" }),
  ]);

  const similar = related.filter((entry) => entry.id !== product.id).slice(0, SIMILAR_LIMIT);
  // Everything else worth a look, most popular first, without repeating what
  // is already on the page.
  const shown = new Set([product.id, ...similar.map((entry) => entry.id)]);
  const explore = popular
    .filter((entry) => !shown.has(entry.id) && entry.inStock)
    .slice(0, EXPLORE_LIMIT)
    .map(toSummary);

  const breadcrumbs = [
    "Home",
    department?.name,
    department?.subcategories.find((entry) => entry.id === product.subcategoryId)?.name,
  ].filter(Boolean) as string[];

  // The shop's own configured fees, so what a product promises is what
  // checkout charges. Priced at a subtotal of 0, which leaves free delivery
  // locked and so describes what unlocks it rather than quoting it as given --
  // unless the product carries its own delivery, in which case there is one
  // option and it is free at any subtotal, which is exactly what a basket of
  // only this product will be charged.
  const deliveryLines: DeliveryLine[] = deliveryOptionsFor(
    0,
    settings,
    product.freeDelivery === true
  ).map((option) => ({
    label: option.name,
    value: option.locked
      ? option.badge
      : `${option.eta} · ${option.fee === 0 ? "Free" : formatPrice(option.fee)}`,
  }));

  const subcategory = department?.subcategories.find((entry) => entry.id === product.subcategoryId);
  const structuredData = [
    productSchema(
      product,
      facts,
      breakdown,
      // A name that is really a phone number is not published.
      reviews.map((review) => ({
        ...review,
        userName: /\d{6,}/.test(review.userName) ? "Zupona customer" : review.userName,
      })),
      subcategory?.name ?? department?.name ?? null
    ),
    breadcrumbSchema(
      [
        { name: "Home", path: "/" },
        ...(department ? [{ name: department.name, path: `/category/${department.id}` }] : []),
        ...(department && subcategory
          ? [{ name: subcategory.name, path: `/category/${department.id}?sub=${subcategory.id}` }]
          : []),
        { name: product.name, path: `/products/${product.slug}` },
      ]
    ),
  ];

  return (
    <StoreShell withStickyActions>
      <JsonLd data={structuredData} />
      <RecordView id={product.id} categoryId={product.categoryId} />
      {/* Facebook and WhatsApp read these to label a shared link as a product
          with its price. React moves them into <head>. */}
      <meta property="og:type" content="product" />
      <meta property="product:price:amount" content={String(product.price)} />
      <meta property="product:price:currency" content="BDT" />
      {/* Tells Meta which product was looked at, which is what a campaign
        * needs to know before it can find more people who look at that kind
        * of thing. Draws nothing. */}
      <PixelEvent
        event="ViewContent"
        params={{
          content_ids: [product.id],
          content_name: product.name,
          content_type: "product",
          content_category: subcategory?.name ?? department?.name ?? undefined,
          currency: "BDT",
          value: product.price,
        }}
      />
      <div className="tab:hidden">
        <ProductHeader />
      </div>
      <DesktopHeader />
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
            showStock={settings.showStockToShoppers}
            requested={requested}
            whatsapp={contact.whatsapp}
            productUrl={`${SITE_URL}/products/${product.slug}`}
            rank={ranks[product.id] ?? null}
            lowStockThreshold={settings.lowStockThreshold}
            sizeGuide={parseSizeGuide(settings.sizeGuide)}
            fit={breakdown.fit ?? null}
            guarantees={<ProductPromises facts={facts} />}
            details={
              <>
                <ProductDescription description={product.description} attributes={product.attributes ?? []} />
                <ProductReviews
                  productId={product.id}
                  breakdown={breakdown}
                  reviews={reviews}
                  reviewableLines={reviewableLines}
                  apparel={(product.optionGroups ?? []).some((group) => group.key === "size")}
                  reward={{ text: settings.reviewPoints, photo: settings.reviewPhotoPoints }}
                />
                <SellerLine seller={seller} />
              </>
            }
          />

          <div className="mt-6 space-y-6 tab:mt-10">
            <SimilarProducts
              products={similar}
              wishlistIds={[...wishlistIds]}
              isSignedIn={Boolean(user)}
            />
            {explore.length > 0 ? (
              <section aria-labelledby="explore-title">
                <h2 id="explore-title" className="text-base font-extrabold text-heading">
                  More to explore
                </h2>
                {/* Far below the buy buttons: it mounts as the shopper scrolls
                    towards it, so its cards cost nothing at load. */}
                <MountWhenNear>
                  <PagedProductGrid
                    products={explore}
                    wishlistIds={[...wishlistIds]}
                    isSignedIn={Boolean(user)}
                    className="mt-2.5"
                  />
                </MountWhenNear>
              </section>
            ) : null}
          </div>
        </StoreContainer>
      </main>
      <SiteFooter />
      {/* No tab bar here: on a phone the bottom of a product page belongs to
          Add to Cart and Buy Now, as on Daraz, and two stacked bars took a
          sixth of the screen. The header still reaches home and the cart. */}
    </StoreShell>
  );
}
