"use server";

import { getDB } from "@/lib/db";
import { requireUser } from "@/lib/session";

export interface AddressActionState {
  error?: string;
  success?: boolean;
}

function readAddressFields(formData: FormData) {
  const label = String(formData.get("label") ?? "Home").trim() || "Home";
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const line1 = String(formData.get("line1") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const isDefault = formData.get("isDefault") === "on";

  if (!fullName || !phone || !line1 || !city) {
    return { error: "Fill in name, phone, address, and city." } as const;
  }

  return { label, fullName, phone, line1, area: area || null, city, postalCode: postalCode || null, isDefault } as const;
}

async function clearDefault(userId: string): Promise<void> {
  const db = await getDB();
  await db.prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").bind(userId).run();
}

export async function addAddressAction(
  _prevState: AddressActionState,
  formData: FormData
): Promise<AddressActionState> {
  const user = await requireUser();
  const fields = readAddressFields(formData);
  if ("error" in fields) return { error: fields.error };

  const db = await getDB();

  const existingCount = await db
    .prepare("SELECT COUNT(*) as count FROM addresses WHERE user_id = ?")
    .bind(user.id)
    .first<{ count: number }>();
  const makeDefault = fields.isDefault || (existingCount?.count ?? 0) === 0;

  if (makeDefault) await clearDefault(user.id);

  await db
    .prepare(
      `INSERT INTO addresses (id, user_id, label, full_name, phone, line1, area, city, postal_code, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      user.id,
      fields.label,
      fields.fullName,
      fields.phone,
      fields.line1,
      fields.area,
      fields.city,
      fields.postalCode,
      makeDefault ? 1 : 0
    )
    .run();

  return { success: true };
}

export async function updateAddressAction(
  addressId: string,
  _prevState: AddressActionState,
  formData: FormData
): Promise<AddressActionState> {
  const user = await requireUser();
  const fields = readAddressFields(formData);
  if ("error" in fields) return { error: fields.error };

  const db = await getDB();
  if (fields.isDefault) await clearDefault(user.id);

  await db
    .prepare(
      `UPDATE addresses
       SET label = ?, full_name = ?, phone = ?, line1 = ?, area = ?, city = ?, postal_code = ?, is_default = ?
       WHERE id = ? AND user_id = ?`
    )
    .bind(
      fields.label,
      fields.fullName,
      fields.phone,
      fields.line1,
      fields.area,
      fields.city,
      fields.postalCode,
      fields.isDefault ? 1 : 0,
      addressId,
      user.id
    )
    .run();

  return { success: true };
}

export async function deleteAddressAction(addressId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDB();
  await db.prepare("DELETE FROM addresses WHERE id = ? AND user_id = ?").bind(addressId, user.id).run();
}

export async function setDefaultAddressAction(addressId: string): Promise<void> {
  const user = await requireUser();
  await clearDefault(user.id);
  const db = await getDB();
  await db
    .prepare("UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?")
    .bind(addressId, user.id)
    .run();
}
