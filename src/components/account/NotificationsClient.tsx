"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Package, Tag, Info } from "lucide-react";
import type { Notification } from "@/types";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/account/notifications/actions";

const ICONS = { order: Package, promo: Tag, system: Info };

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(`${iso.replace(" ", "T")}Z`).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsClient({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const hasUnread = notifications.some((n) => !n.isRead);

  function markRead(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  function markAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  if (notifications.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
          <Bell className="h-7 w-7 text-brand" />
        </span>
        <p className="text-sm font-semibold text-ink">No notifications yet</p>
        <p className="max-w-xs text-xs text-ink-slate">
          Order updates and offers will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {hasUnread && (
        <button onClick={markAllRead} className="self-end text-xs font-semibold text-brand">
          Mark all as read
        </button>
      )}

      {notifications.map((notification) => {
        const Icon = ICONS[notification.type];
        const content = (
          <div
            className={`flex gap-3 rounded-2xl p-4 shadow-card ${
              notification.isRead ? "bg-white" : "bg-brand-tint/60"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-heading">{notification.title}</p>
                {!notification.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
              </div>
              <p className="mt-0.5 text-xs text-ink-slate">{notification.body}</p>
              <p className="mt-1 text-[11px] text-ink-slate">{timeAgo(notification.createdAt)}</p>
            </div>
          </div>
        );

        if (notification.orderId) {
          return (
            <Link
              key={notification.id}
              href={`/account/orders/${notification.orderId}`}
              onClick={() => !notification.isRead && markRead(notification.id)}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={notification.id}
            onClick={() => !notification.isRead && markRead(notification.id)}
            className="text-left"
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
