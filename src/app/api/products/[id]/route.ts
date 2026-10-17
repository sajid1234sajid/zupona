/** One product with its options, for the Quick-View picker a product card
 * opens when the product comes in sizes or colours.
 *
 * The same cached read the product page renders from, so the options, prices
 * and stock the picker offers are the page's own. Stock moves, so the answer
 * is kept briefly; the cart action re-checks everything when the shopper
 * actually adds. */

import { getStoreProduct } from "@/lib/storefront";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const product = await getStoreProduct(id);
  if (!product) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify(product), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
  });
}
