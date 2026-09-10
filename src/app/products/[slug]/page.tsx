import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductHeader from "@/components/layout/ProductHeader";
import BottomNav from "@/components/layout/BottomNav";
import StoreShell, { StoreContainer } from "@/components/layout/StoreShell";
import ProductView from "@/components/product/dynamic/ProductView";
import type { DeliveryLine } from "@/components/product/dynamic/DeliveryCard";
import { getStoreProductBySlug, getStoreCategory } from "@/lib/storefront";
import { getDeliveryFees } from "@/lib/shopSettings";
import { deliveryMethodsWithFees } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";

/** The dynamic product page.
 *
 * One page for the whole catalogue. Which selectors appear, whether there is a
 * video, what the trust strip says -- all of it comes from the product, so a
 * category invented tomorrow needs no code.
 *
 * The older /product/[id] route is left exactly as it was and still serves the
 * previous page; nothing here replaces it until this one has been through
 * acceptance. */

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

  const [product, user, fees] = await Promise.all([
    getStoreProductBySlug(slug),
    getCurrentUser(),
    getDeliveryFees(),
  ]);

  // Covers both "never existed" and "unpublished in the admin panel", which
  // should look the same to a shopper.
  if (!product) notFound();

  const [wishlistIds, department] = await Promise.all([
    getWishlistProductIds(user?.id ?? null),
    product.categoryId ? getStoreCategory(product.categoryId) : Promise.resolve(undefined),
  ]);

  const breadcrumbs = [
    "Home",
    department?.name,
    department?.subcategories.find((entry) => entry.id === product.subcategoryId)?.name,
  ].filter(Boolean) as string[];

  // The shop's own configured fees, so what a product promises is what
  // checkout charges.
  const deliveryLines: DeliveryLine[] = [
    ...deliveryMethodsWithFees(fees).map((method) => ({
      label: method.name,
      value: `${method.eta} · ${formatPrice(method.fee)}`,
    })),
    { label: "Cash on Delivery", value: "Available" },
  ];

  return (
    <StoreShell withStickyActions>
      <ProductHeader />
      <main className="flex-1">
        <StoreContainer className="py-4">
          <ProductView
            product={product}
            breadcrumbs={breadcrumbs}
            deliveryLines={deliveryLines}
            initiallyWishlisted={wishlistIds.has(product.id)}
          />
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
