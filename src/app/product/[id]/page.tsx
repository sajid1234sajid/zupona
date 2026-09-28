import { notFound, redirect } from "next/navigation";
import { getStoreProduct } from "@/lib/storefront";

/** The old id-based product address.
 *
 * Product cards link straight to `/products/<slug>` now; this stays only for
 * bookmarks, old links and search engines that still hold the id-based
 * address, forwarding to the product page rather than rendering a second,
 * older design. Temporary (307) on purpose: a renamed slug must not leave
 * browsers holding a cached permanent redirect to an address that no longer
 * exists. */
export default async function ProductRedirect({ params }: PageProps<"/product/[id]">) {
  const { id } = await params;
  const product = await getStoreProduct(id);

  if (!product) notFound();
  redirect(`/products/${product.slug}`);
}
