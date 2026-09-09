import { getDB } from "@/lib/db";
import type { PaymentMethod, PaymentMethodType } from "@/types";

interface PaymentMethodRow {
  id: string;
  type: PaymentMethodType;
  label: string;
  detail: string | null;
  is_default: number;
}

function toPaymentMethod(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    detail: row.detail,
    isDefault: row.is_default === 1,
  };
}

export async function getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT id, type, label, detail, is_default FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC")
    .bind(userId)
    .all<PaymentMethodRow>();
  return results.map(toPaymentMethod);
}

export function maskCardNumber(cardNumber: string): { last4: string; brand: string } {
  const digits = cardNumber.replace(/\D/g, "");
  const last4 = digits.slice(-4).padStart(4, "0");
  let brand = "Card";
  if (digits.startsWith("4")) brand = "Visa";
  else if (/^5[1-5]/.test(digits)) brand = "Mastercard";
  else if (/^3[47]/.test(digits)) brand = "Amex";
  return { last4, brand };
}
