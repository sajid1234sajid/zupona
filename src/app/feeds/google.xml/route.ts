/** The Google Merchant Center feed, from the same rows as the Meta one:
 * https://zupona.com/feeds/google.xml. See `src/lib/productFeed.ts`. */

import { getFeedItems, toGoogleXml } from "@/lib/productFeed";

export async function GET() {
  return new Response(toGoogleXml(await getFeedItems()), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
