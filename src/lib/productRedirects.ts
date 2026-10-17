/** Where a retired product address goes now; see migration 0031.
 *
 * Only read when a product is not found, so it costs nothing on the pages
 * that resolve normally. The target must still be live: a redirect to an
 * archived product would only trade one dead page for another. */

import { getDB } from "@/lib/db";

export async function productRedirect(by: { slug: string } | { id: string }): Promise<string | null> {
  const db = await getDB();
  const column = "slug" in by ? "r.from_slug" : "r.from_id";
  const row = await db
    .prepare(
      `SELECT p.slug, r.query FROM product_redirects r
       JOIN products p ON p.id = r.to_product_id
       WHERE ${column} = ? AND p.status = 'active'
       LIMIT 1`
    )
    .bind("slug" in by ? by.slug : by.id)
    .first<{ slug: string; query: string | null }>()
    .catch(() => null);
  if (!row) return null;
  return `/products/${row.slug}${row.query ? `?${row.query}` : ""}`;
}
