"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { collectCoupon } from "@/lib/couponWallet";

export interface CollectResult {
  ok: boolean;
  error?: string;
  /** Not signed in: the page sends the shopper to sign in first. */
  signIn?: boolean;
}

/** "Collect" on the Offers page. */
export async function collectCouponAction(couponId: string): Promise<CollectResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, signIn: true };
  const result = await collectCoupon(user.id, { id: couponId });
  revalidatePath("/offers");
  revalidatePath("/account/coupons");
  return result;
}

/** A code typed into Account > My coupons. */
export async function addCouponCodeAction(
  _prev: CollectResult,
  form: FormData
): Promise<CollectResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, signIn: true };
  const code = String(form.get("code") ?? "").trim();
  if (!code) return { ok: false, error: "Enter a coupon code." };
  const result = await collectCoupon(user.id, { code });
  revalidatePath("/account/coupons");
  return result;
}
