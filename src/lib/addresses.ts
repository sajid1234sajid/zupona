import { getDB } from "@/lib/db";
import type { Address } from "@/types";

interface AddressRow {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  area: string | null;
  city: string;
  postal_code: string | null;
  is_default: number;
}

function toAddress(row: AddressRow): Address {
  return {
    id: row.id,
    label: row.label,
    fullName: row.full_name,
    phone: row.phone,
    line1: row.line1,
    area: row.area,
    city: row.city,
    postalCode: row.postal_code,
    isDefault: row.is_default === 1,
  };
}

export async function getAddresses(userId: string): Promise<Address[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      "SELECT id, label, full_name, phone, line1, area, city, postal_code, is_default FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC"
    )
    .bind(userId)
    .all<AddressRow>();
  return results.map(toAddress);
}
