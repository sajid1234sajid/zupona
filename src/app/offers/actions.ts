"use server";

import { getDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/** "Remind me" on an upcoming flash sale. A guest is told to sign in, since
 * the reminder arrives in their account. */
export async function remindMeAction(saleId: string): Promise<{ ok: boolean; signIn?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, signIn: true };
  const db = await getDB();
  await db
    .prepare(
      `INSERT OR IGNORE INTO flash_sale_reminders (user_id, flash_sale_id)
       SELECT ?, id FROM flash_sales WHERE id = ? AND is_active = 1 AND datetime(starts_at) > datetime('now')`
    )
    .bind(user.id, String(saleId))
    .run();
  return { ok: true };
}
