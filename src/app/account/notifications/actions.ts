"use server";

import { getDB } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function markNotificationReadAction(id: string): Promise<void> {
  const user = await requireUser();
  const db = await getDB();
  await db
    .prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .run();
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  const db = await getDB();
  await db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").bind(user.id).run();
}
