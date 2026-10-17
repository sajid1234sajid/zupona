/** Who sells a product, for the line on its page.
 *
 * A product with no seller, or whose seller is not approved, is the shop's
 * own and reads "Sold by Zupona". */

import { getDB } from "@/lib/db";

export interface ProductSeller {
  name: string;
  logo: string | null;
  verified: boolean;
  rating: number;
  ratingCount: number;
  products: number;
  since: string | null;
}

export async function getProductSeller(productId: string): Promise<ProductSeller | null> {
  const db = await getDB();
  const row = await db
    .prepare(
      `SELECT s.store_name, s.logo_url, s.rating_avg, s.rating_count, s.approved_at,
              (SELECT COUNT(*) FROM products x WHERE x.seller_id = s.id AND x.status = 'active') AS products,
              EXISTS (SELECT 1 FROM seller_documents d WHERE d.seller_id = s.id AND d.status = 'approved') AS verified
       FROM products p JOIN sellers s ON s.id = p.seller_id
       WHERE p.id = ? AND s.status = 'approved'`
    )
    .bind(productId)
    .first<{
      store_name: string;
      logo_url: string | null;
      rating_avg: number;
      rating_count: number;
      approved_at: string | null;
      products: number;
      verified: number;
    }>();
  if (!row) return null;
  return {
    name: row.store_name,
    logo: row.logo_url,
    verified: row.verified === 1,
    rating: row.rating_avg,
    ratingCount: row.rating_count,
    products: row.products,
    since: row.approved_at,
  };
}
