import Link from "next/link";
import DesktopHeader from "@/components/layout/DesktopHeader";
import { ChevronLeft, Star, ShoppingBag } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getOrders } from "@/lib/orders";
import { SHOP_TIME_ZONE } from "@/lib/format";

export default async function PointsPage() {
  const user = await requireUser();
  const orders = await getOrders(user.id);
  const earningOrders = orders.filter((o) => o.pointsEarned > 0);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-10 tab:max-w-none tab:pb-12">
      <DesktopHeader />
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3 tab:mx-auto tab:mt-6 tab:w-full tab:max-w-2xl tab:rounded-2xl tab:border">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-base font-bold text-heading">Zupona Points</h1>
      </header>
      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-2xl tab:px-0">
        <div className="rounded-2xl bg-brand-darkest p-5 text-white">
          <p className="text-xs text-brand-tint">Your balance</p>
          <div className="mt-1 flex items-center gap-2">
            <Star className="h-6 w-6 fill-gold text-gold" />
            <span className="text-3xl font-bold">{user.points}</span>
            <span className="text-sm text-brand-tint">pts</span>
          </div>
          <p className="mt-2 text-xs text-brand-tint">Earn 1 point for every ৳50 you spend.</p>
        </div>

        <h2 className="mb-2 mt-5 text-sm font-bold text-heading">History</h2>
        {earningOrders.length === 0 ? (
          <p className="text-xs text-ink-slate">Place an order to start earning points.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {earningOrders.map((order) => (
              <div key={order.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-heading">Order {order.orderNumber}</p>
                  <p className="text-xs text-ink-slate">
                    {new Date(`${order.placedAt.replace(" ", "T")}Z`).toLocaleDateString("en-US", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      timeZone: SHOP_TIME_ZONE,
                    })}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-brand">+{order.pointsEarned} pts</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
