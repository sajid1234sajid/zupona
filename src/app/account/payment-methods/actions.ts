"use server";

import { getDB } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { maskCardNumber } from "@/lib/paymentMethods";
import type { PaymentMethodType } from "@/types";

export interface PaymentMethodActionState {
  error?: string;
  success?: boolean;
}

function readFields(formData: FormData) {
  const type = String(formData.get("type") ?? "card") as PaymentMethodType;
  const isDefault = formData.get("isDefault") === "on";

  if (type === "card") {
    const cardNumber = String(formData.get("cardNumber") ?? "").trim();
    const holderName = String(formData.get("holderName") ?? "").trim();
    const expiry = String(formData.get("expiry") ?? "").trim();
    if (cardNumber.replace(/\D/g, "").length < 12 || !holderName || !expiry) {
      return { error: "Enter a valid card number, holder name, and expiry." } as const;
    }
    const { last4, brand } = maskCardNumber(cardNumber);
    return {
      type,
      label: `${brand} •••• ${last4}`,
      detail: `${holderName} · Exp ${expiry}`,
      isDefault,
    } as const;
  }

  if (type === "bkash" || type === "nagad") {
    const number = String(formData.get("mobileNumber") ?? "").trim();
    if (number.replace(/\D/g, "").length < 8) {
      return { error: "Enter a valid mobile number." } as const;
    }
    const masked = number.replace(/\d(?=\d{3})/g, "•");
    return {
      type,
      label: type === "bkash" ? "bKash" : "Nagad",
      detail: masked,
      isDefault,
    } as const;
  }

  return { type, label: "Cash on Delivery", detail: "Pay when your order arrives", isDefault } as const;
}

async function clearDefault(userId: string): Promise<void> {
  const db = await getDB();
  await db.prepare("UPDATE payment_methods SET is_default = 0 WHERE user_id = ?").bind(userId).run();
}

export async function addPaymentMethodAction(
  _prevState: PaymentMethodActionState,
  formData: FormData
): Promise<PaymentMethodActionState> {
  const user = await requireUser();
  const fields = readFields(formData);
  if ("error" in fields) return { error: fields.error };

  const db = await getDB();
  const existingCount = await db
    .prepare("SELECT COUNT(*) as count FROM payment_methods WHERE user_id = ?")
    .bind(user.id)
    .first<{ count: number }>();
  const makeDefault = fields.isDefault || (existingCount?.count ?? 0) === 0;

  if (makeDefault) await clearDefault(user.id);

  await db
    .prepare(
      "INSERT INTO payment_methods (id, user_id, type, label, detail, is_default) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(crypto.randomUUID(), user.id, fields.type, fields.label, fields.detail, makeDefault ? 1 : 0)
    .run();

  return { success: true };
}

export async function deletePaymentMethodAction(id: string): Promise<void> {
  const user = await requireUser();
  const db = await getDB();
  await db.prepare("DELETE FROM payment_methods WHERE id = ? AND user_id = ?").bind(id, user.id).run();
}

export async function setDefaultPaymentMethodAction(id: string): Promise<void> {
  const user = await requireUser();
  await clearDefault(user.id);
  const db = await getDB();
  await db
    .prepare("UPDATE payment_methods SET is_default = 1 WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .run();
}
