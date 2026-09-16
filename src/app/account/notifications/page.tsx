import Link from "next/link";
import DesktopHeader from "@/components/layout/DesktopHeader";
import { ChevronLeft } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import NotificationsClient from "@/components/account/NotificationsClient";
import { requireUser } from "@/lib/session";
import { getNotifications } from "@/lib/notifications";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await getNotifications(user.id);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-20 tab:max-w-none tab:pb-12">
      <DesktopHeader />
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3 tab:mx-auto tab:mt-6 tab:w-full tab:max-w-2xl tab:rounded-2xl tab:border">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-base font-bold text-heading">Notifications</h1>
      </header>
      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-2xl tab:px-0">
        <NotificationsClient notifications={notifications} />
      </main>
      <BottomNav />
    </div>
  );
}
