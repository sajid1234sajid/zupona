"use server";

import { revalidatePath } from "next/cache";
import { getDB } from "@/lib/db";
import { logAdminAction, requireAdmin, setUserRole, setUserStatus } from "@/lib/admin";
import type { UserRole } from "@/types";

const ROLES: UserRole[] = ["customer", "seller", "support", "admin"];
const STATUSES = ["active", "suspended", "banned"] as const;

function refresh(userId?: string): void {
  revalidatePath("/admin/customers");
  if (userId) revalidatePath(`/admin/customers/${userId}`);
}

/** Suspending or banning signs the account out everywhere immediately --
 * `setUserStatus` deletes their sessions, and `getCurrentUser` filters on
 * status, so the decision takes effect on their very next request. */
export async function setCustomerStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "") as (typeof STATUSES)[number];

  if (!userId || !STATUSES.includes(status)) return;

  // Locking yourself out of the panel you are standing in is never intended.
  if (userId === admin.id) return;

  const db = await getDB();
  const before = await db
    .prepare("SELECT status FROM users WHERE id = ?")
    .bind(userId)
    .first<{ status: string }>();

  if (!before || before.status === status) return;

  await setUserStatus(userId, status);
  await logAdminAction(admin.id, `user.${status}`, "user", userId, {
    before,
    after: { status },
  });

  refresh(userId);
}

export async function setCustomerRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;

  if (!userId || !ROLES.includes(role)) return;

  // Demoting yourself would revoke the permission mid-request.
  if (userId === admin.id) return;

  const db = await getDB();
  const before = await db
    .prepare("SELECT role FROM users WHERE id = ?")
    .bind(userId)
    .first<{ role: string }>();

  if (!before || before.role === role) return;

  await setUserRole(userId, role);
  await logAdminAction(admin.id, `user.role.${role}`, "user", userId, {
    before,
    after: { role },
  });

  refresh(userId);
}

/** Adjusts a loyalty balance, e.g. as a goodwill gesture after a bad delivery.
 * The reason is written to the audit log so the adjustment is explainable
 * later. */
export async function adjustPointsAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const delta = Number.parseInt(String(formData.get("points") ?? "0"), 10);
  const reason = String(formData.get("reason") ?? "").trim() || "Manual adjustment";

  if (!userId || !Number.isFinite(delta) || delta === 0) return;

  const db = await getDB();
  await db
    .prepare(
      "UPDATE users SET points = MAX(0, points + ?), updated_at = datetime('now') WHERE id = ?"
    )
    .bind(delta, userId)
    .run();

  await db
    .prepare(
      `INSERT INTO notifications (id, user_id, title, body, type)
       VALUES (?, ?, ?, ?, 'system')`
    )
    .bind(
      crypto.randomUUID(),
      userId,
      delta > 0 ? `You earned ${delta} points` : `${Math.abs(delta)} points were removed`,
      reason
    )
    .run();

  await logAdminAction(admin.id, "user.points", "user", userId, { after: { delta, reason } });
  refresh(userId);
}
