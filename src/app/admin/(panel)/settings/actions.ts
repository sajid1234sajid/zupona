"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { invalidate, invalidateCatalog } from "@/lib/cache";
import { AuthorizationError, logAdminAction, requireAdmin, setSetting } from "@/lib/admin";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireUser } from "@/lib/session";

export interface SettingsFormState {
  error?: string;
  success?: string;
}

/** Settings the panel exposes, with the shape each value must take.
 *
 * Whitelisted rather than "write whatever the form posts": `site_settings` is
 * a free-form key/value table, so without this an unexpected field name would
 * quietly create a setting nothing reads. */
const EDITABLE: Record<string, "text" | "number" | "boolean"> = {
  store_name: "text",
  store_tagline: "text",
  support_email: "text",
  support_phone: "text",
  currency_symbol: "text",
  free_shipping_threshold: "number",
  standard_shipping_fee: "number",
  express_shipping_fee: "number",
  default_commission_rate: "number",
  low_stock_threshold: "number",
  reviews_need_approval: "boolean",
  guest_checkout_enabled: "boolean",
  maintenance_mode: "boolean",
};

function toFormError(error: unknown): SettingsFormState {
  if (error instanceof AuthorizationError) return { error: error.message };
  throw error;
}

export async function saveSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  try {
    const admin = await requireAdmin();
    const changed: Record<string, string> = {};

    for (const [key, kind] of Object.entries(EDITABLE)) {
      // Checkboxes post nothing when unticked, so booleans are read from
      // presence and every other field is skipped when absent from this form.
      if (kind === "boolean") {
        if (formData.get(`__present_${key}`) === null) continue;
        changed[key] = formData.get(key) !== null ? "1" : "0";
        continue;
      }

      const raw = formData.get(key);
      if (raw === null) continue;

      const value = String(raw).trim();
      if (kind === "number") {
        const parsed = Number.parseInt(value.replace(/[^\d-]/g, ""), 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
          return { error: `${key.replace(/_/g, " ")} must be a number of zero or more.` };
        }
        changed[key] = String(parsed);
      } else {
        changed[key] = value.slice(0, 200);
      }
    }

    if (Object.keys(changed).length === 0) return { error: "Nothing to save." };

    for (const [key, value] of Object.entries(changed)) {
      await setSetting(key, value);
    }

    await logAdminAction(admin.id, "settings.update", "settings", null, { after: changed });
    await invalidate("settings:all");
    await invalidateCatalog();
  } catch (error) {
    return toFormError(error);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { success: "Settings saved." };
}

/** Changing your own admin password.
 *
 * Deliberately separate from the settings form: it needs the current password
 * as proof, and mixing it into a save-everything form would mean typing your
 * password to change the shipping fee. */
export async function changeAdminPasswordAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const user = await requireUser();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 10) {
    return { error: "An admin password must be at least 10 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "The two new passwords don't match." };
  }

  const db = await getDB();
  const row = await db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ password_hash: string | null }>();

  if (row?.password_hash && !(await verifyPassword(currentPassword, row.password_hash))) {
    return { error: "Your current password is incorrect." };
  }

  const passwordHash = await hashPassword(newPassword);

  await db.batch([
    db
      .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(passwordHash, user.id),
    // Every other device is signed out, which is the point of changing a
    // password. The current session's row is left alone so the person doing it
    // is not logged out mid-task.
    db
      .prepare("DELETE FROM sessions WHERE user_id = ? AND id != (SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1)")
      .bind(user.id, user.id),
  ]);

  await logAdminAction(user.id, "admin.password.change", "user", user.id);
  return { success: "Password changed. Other devices have been signed out." };
}
