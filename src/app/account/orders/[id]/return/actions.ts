"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { createReturnRequest, type ReturnRequestInput } from "@/lib/returns";

/** A shopper asks to return items from one of their delivered orders.
 * Everything is checked again in `createReturnRequest` against the order as
 * the database has it; the form only proposes. */
export async function requestReturnAction(input: ReturnRequestInput): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const result = await createReturnRequest(user.id, {
    orderId: String(input.orderId ?? ""),
    items: Array.isArray(input.items)
      ? input.items.slice(0, 50).map((item) => ({
          orderItemId: String(item?.orderItemId ?? ""),
          quantity: Number(item?.quantity) || 0,
        }))
      : [],
    reason: String(input.reason ?? ""),
    detail: String(input.detail ?? ""),
    photos: Array.isArray(input.photos) ? input.photos.map(String) : [],
    resolution: String(input.resolution ?? ""),
    refundMethod: input.refundMethod ? String(input.refundMethod) : null,
    refundAccount: input.refundAccount ? String(input.refundAccount) : null,
  });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/account/returns");
  revalidatePath(`/account/orders/${input.orderId}`);
  return { ok: true };
}
