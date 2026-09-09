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

export async function getNotifications(userId: string): Promise<Notification[]> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC")
    .bind(userId)
    .all<NotificationRow>();
  return results.map(toNotification);
}

export async function getUnreadNotificationCount(userId: string | null): Promise<number> {
  if (!userId) return 0;
  const db = await getDB();
  const row = await db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0")
    .bind(userId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}
