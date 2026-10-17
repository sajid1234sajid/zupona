/** One review photo; see `handleShopperPhoto`. */

import { handleShopperPhoto } from "@/lib/shopperPhoto";

export async function POST(request: Request) {
  return handleShopperPhoto(request, "reviews");
}
