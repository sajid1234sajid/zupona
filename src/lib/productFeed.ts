/** The product catalog as Meta Commerce Manager and Google Merchant Center
 * read it, for catalog ads that show each shopper the products they looked at.
 *
 * One row per product. Its `id` is the product id -- exactly the
 * `content_ids` every pixel and Conversions API event sends -- which is how
 * Meta ties "viewed this" to the row it advertises. Built from the database
 * once an hour (and whenever an admin edit clears the `catalog:` cache), so
 * the owner can point a scheduled feed at a fixed address. */

import { getDB } from "@/lib/db";
import { cached } from "@/lib/cache";
import { plainText } from "@/lib/seo";
import { SITE_URL } from "@/lib/shareCard";

export interface FeedItem {
  id: string;
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  /** "1499 BDT": the regular price. */
  price: string;
  /** The sale price when the product is discounted. */
  salePrice: string | null;
  link: string;
  imageLink: string;
  additionalImageLinks: string[];
  brand: string;
  productType: string;
}

const absolute = (src: string) => (src.startsWith("http") ? src : `${SITE_URL}${src}`);

export async function getFeedItems(): Promise<FeedItem[]> {
  return cached(
    "catalog:feed",
    async () => {
      const db = await getDB();
      const { results } = await db
        .prepare(
          `SELECT p.id, p.slug, p.name, p.description, p.short_description, p.meta_description,
                  p.price, p.old_price, p.track_inventory,
                  (SELECT name FROM brands b WHERE b.id = p.brand_id) AS brand,
                  c.name AS category, parent.name AS department,
                  (SELECT group_concat(url, char(10)) FROM
                     (SELECT url FROM product_images i WHERE i.product_id = p.id
                       ORDER BY i.is_primary DESC, i.sort_order ASC LIMIT 10)) AS images,
                  (SELECT COALESCE(SUM(v.stock_quantity - v.reserved_quantity), 0)
                     FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS stock
           FROM products p
           LEFT JOIN categories c ON c.id = p.category_id
           LEFT JOIN categories parent ON parent.id = c.parent_id
           WHERE p.status = 'active'
           ORDER BY p.created_at DESC`
        )
        .all<{
          id: string;
          slug: string;
          name: string;
          description: string | null;
          short_description: string | null;
          meta_description: string | null;
          price: number;
          old_price: number;
          track_inventory: number;
          brand: string | null;
          category: string | null;
          department: string | null;
          images: string | null;
          stock: number;
        }>();

      return results
        .map((row) => {
          const images = (row.images ?? "").split("\n").filter(Boolean).map(absolute);
          const discounted = row.old_price > row.price;
          return {
            id: row.id,
            title: plainText(row.name).slice(0, 150),
            description:
              plainText(row.meta_description || row.description || row.short_description || row.name).slice(0, 5000) ||
              row.name,
            availability: row.track_inventory === 0 || row.stock > 0 ? "in stock" : "out of stock",
            price: `${discounted ? row.old_price : row.price} BDT`,
            salePrice: discounted ? `${row.price} BDT` : null,
            link: `${SITE_URL}/products/${row.slug}`,
            imageLink: images[0] ?? "",
            additionalImageLinks: images.slice(1),
            brand: row.brand || "Zupona",
            productType: [row.department, row.category].filter(Boolean).join(" > "),
          } satisfies FeedItem;
        })
        // A row without a picture is rejected by both platforms.
        .filter((item) => item.imageLink);
    },
    3600
  );
}

/** One CSV field, quoted when it has to be. */
function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toMetaCsv(items: FeedItem[]): string {
  const header = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "sale_price",
    "link",
    "image_link",
    "additional_image_link",
    "brand",
    "product_type",
  ];
  const rows = items.map((item) =>
    [
      item.id,
      item.title,
      item.description,
      item.availability,
      "new",
      item.price,
      item.salePrice ?? "",
      item.link,
      item.imageLink,
      item.additionalImageLinks.join(","),
      item.brand,
      item.productType,
    ]
      .map(csvField)
      .join(",")
  );
  return [header.join(","), ...rows].join("\n");
}

const xml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function toGoogleXml(items: FeedItem[]): string {
  const entries = items
    .map(
      (item) => `  <item>
    <g:id>${xml(item.id)}</g:id>
    <title>${xml(item.title)}</title>
    <description>${xml(item.description)}</description>
    <link>${xml(item.link)}</link>
    <g:image_link>${xml(item.imageLink)}</g:image_link>
${item.additionalImageLinks.map((link) => `    <g:additional_image_link>${xml(link)}</g:additional_image_link>`).join("\n")}
    <g:availability>${item.availability}</g:availability>
    <g:condition>new</g:condition>
    <g:price>${item.price}</g:price>
${item.salePrice ? `    <g:sale_price>${item.salePrice}</g:sale_price>\n` : ""}    <g:brand>${xml(item.brand)}</g:brand>
    <g:product_type>${xml(item.productType)}</g:product_type>
  </item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Zupona</title>
  <link>${SITE_URL}</link>
  <description>Zupona product catalog</description>
${entries}
</channel>
</rss>
`;
}
