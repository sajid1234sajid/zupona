import type { MetadataRoute } from "next";
import { listStoreCategories, listStoreProducts } from "@/lib/storefront";

const ORIGIN = "https://zupona.com";

/** Every page worth indexing, built from the catalog rather than typed out.
 *
 * A product listed in the admin panel appears here without anyone remembering
 * to add it, and one that is unpublished drops out -- `listStoreProducts`
 * returns only active products, and it is the same KV-cached read the shop
 * itself renders from, so this costs no extra database work.
 *
 * Pages that belong to one shopper -- cart, account, checkout, wishlist -- are
 * left out for the same reason `robots.ts` disallows them. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    listStoreProducts({ sort: "newest" }),
    listStoreCategories(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: ORIGIN, changeFrequency: "daily", priority: 1 },
    { url: `${ORIGIN}/categories`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${ORIGIN}/offers`, changeFrequency: "daily", priority: 0.8 },
    { url: `${ORIGIN}/new-arrivals`, changeFrequency: "daily", priority: 0.7 },
  ];

  return [
    ...staticPages,
    ...categories.map((category) => ({
      url: `${ORIGIN}/category/${category.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: `${ORIGIN}/product/${product.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
