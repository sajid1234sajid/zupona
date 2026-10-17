import { getDB } from "@/lib/db";
import type { Notification } from "@/types";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  type: Notification["type"];
  order_id: string | null;
  is_read: number;
  created_at: string;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type,
    orderId: row.order_id,
    isRead: row.is_read === 1,
    createdAt: row.created_at,
  };
}

/** Writes the "your flash sale has started" notifications this shopper asked
 * for and is now due, once each. There is no background job, so it runs when
 * the shopper's notifications are read: they see it the next time they look. */
export async function deliverDueReminders(userId: string): Promise<void> {
  const db = await getDB();
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO notifications (id, user_id, title, body, type)
           SELECT lower(hex(randomblob(16))), r.user_id, s.name || ' has started',
                  'The sale you asked to be reminded about is on now, until ' ||
                  strftime('%H:%M on %d/%m', s.ends_at, '+6 hours') || ' (Dhaka time).', 'promo'
           FROM flash_sale_reminders r JOIN flash_sales s ON s.id = r.flash_sale_id
           WHERE r.user_id = ? AND r.notified_at IS NULL AND s.is_active = 1
             AND datetime(s.starts_at) <= datetime('now') AND datetime(s.ends_at) > datetime('now')`
        )
        .bind(userId),
      db
        .prepare(
          `UPDATE flash_sale_reminders SET notified_at = datetime('now')
           WHERE user_id = ? AND notified_at IS NULL
             AND flash_sale_id IN (SELECT id FROM flash_sales WHERE datetime(starts_at) <= datetime('now'))`
        )
        .bind(userId),
    ]);
  } catch (error) {
    console.error("flash sale reminders failed", error);
  }
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  await deliverDueReminders(userId);
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC")
    .bind(userId)
    .all<NotificationRow>();
  return results.map(toNotification);
}

export async function getUnreadNotificationCount(userId: string | null): Promise<number> {
  if (!userId) return 0;
  await deliverDueReminders(userId);
  const db = await getDB();
  const row = await db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0")
    .bind(userId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}
