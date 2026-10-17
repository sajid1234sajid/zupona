/** The Meta catalog feed: point a scheduled feed in Commerce Manager at
 * https://zupona.com/feeds/meta.csv. See `src/lib/productFeed.ts`. */

import { getFeedItems, toMetaCsv } from "@/lib/productFeed";

export async function GET() {
  return new Response(toMetaCsv(await getFeedItems()), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
