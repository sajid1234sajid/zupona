"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction, requireStaff } from "@/lib/admin";
import { advanceReturn } from "@/lib/returns";
import { RETURN_STATUS_LABELS, type ReturnStatus } from "@/lib/returnOptions";

/** Moves a return request one step. What each step sets off -- the
 * customer's notification, stock back on the shelf, a store-credit coupon,
 * points taken back -- happens in `advanceReturn`. */
export async function advanceReturnAction(input: {
  id: string;
  status: string;
  note: string;
  refundAmount: number | null;
  restock: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff();
  const status = String(input.status) as ReturnStatus;
  if (!(status in RETURN_STATUS_LABELS)) return { ok: false, error: "Unknown step." };
  const amount = input.refundAmount === null || input.refundAmount === undefined ? null : Number(input.refundAmount);
  const result = await advanceReturn({
    id: String(input.id),
    status,
    note: String(input.note ?? ""),
    refundAmount: amount !== null && Number.isFinite(amount) ? amount : null,
    restock: Boolean(input.restock),
    actorId: staff.id,
  });
  if (!result.ok) return result;
  await logAdminAction(staff.id, `return.${status}`, "return", String(input.id), {
    after: { status, refundAmount: amount, restock: Boolean(input.restock) },
  });
  revalidatePath("/admin/orders/returns");
  return { ok: true };
}
