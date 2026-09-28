import { notFound, redirect } from "next/navigation";
import { getStoreProduct } from "@/lib/storefront";

/** The old id-based product address.
 *
 * Nothing in the app links here anymore -- every product card, the sitemap,
 * and the "similar products" rail all point straight at `/products/<slug>`.
 * This route only catches whoever still has the old address: a bookmark, an
 * old backlink, or a search result Google hasn't dropped yet. It forwards to
 * `/products/<slug>` rather than rendering a second, older design. Temporary
 * (307) on purpose: a renamed slug must not leave browsers holding a cached
 * permanent redirect to an address that no longer exists. */
export default async function ProductRedirect({ params }: PageProps<"/product/[id]">) {
  const { id } = await params;
  const product = await getStoreProduct(id);

  if (!product) notFound();
  redirect(`/products/${product.slug}`);
}
