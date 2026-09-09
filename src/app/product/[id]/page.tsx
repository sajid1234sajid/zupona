import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductHeader from "@/components/layout/ProductHeader";
import BottomNav from "@/components/layout/BottomNav";
import ProductGallery from "@/components/product/ProductGallery";
import ProductInfo from "@/components/product/ProductInfo";
import ProductPurchasePanel from "@/components/product/ProductPurchasePanel";
import TrustBadges from "@/components/product/TrustBadges";
import { getStoreProduct } from "@/lib/storefront";
import { getCurrentUser } from "@/lib/session";
import { getWishlistProductIds } from "@/lib/wishlist";

/** Rendered on demand rather than pre-listed at build time.
 *
 * The catalog is edited in the admin panel now, so the set of products is not
 * known when the app is built -- a product added this afternoon has to work
 * without a redeploy. */
export async function generateMetadata({
  params,
}: PageProps<"/product/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = await getStoreProduct(id);
  if (!product) return { title: "Product not found — Zupona" };

  return {
    title: `${product.name} — Zupona`,
    description:
      product.description?.slice(0, 155) ??
      `Buy ${product.name} on Zupona with fast delivery across Bangladesh.`,
  };
}

export default async function ProductPage({ params }: PageProps<"/product/[id]">) {
  const { id } = await params;

  const [product, user] = await Promise.all([getStoreProduct(id), getCurrentUser()]);

  // Covers both "never existed" and "unpublished in the admin panel", which
  // should look the same to a shopper.
  if (!product) notFound();

  const wishlistIds = await getWishlistProductIds(user?.id ?? null);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white">
      <ProductHeader />
      <main className="flex-1 pb-36">
        <ProductGallery product={product} />
        <ProductInfo product={product} isWishlisted={wishlistIds.has(product.id)} />
        <ProductPurchasePanel productId={product.id} colors={product.colors} />
        <TrustBadges />
      </main>
      <BottomNav />
    </div>
  );
}
