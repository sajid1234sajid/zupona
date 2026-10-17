/** One photo for a return request; see `handleShopperPhoto`. */

import { handleShopperPhoto } from "@/lib/shopperPhoto";

export async function POST(request: Request) {
  return handleShopperPhoto(request, "returns");
}
