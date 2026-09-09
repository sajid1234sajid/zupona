import Link from "next/link";
import { ChevronLeft, Star, ShoppingBag } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getOrders } from "@/lib/orders";

export default async function PointsPage() {
  const user = await requireUser();
  const orders = await getOrders(user.id);
  const earningOrders = orders.filter((o) => o.pointsEarned > 0);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#f3f5f4] pb-10">
      <header className="flex items-center gap-3 border-b border-neutral-100 bg-white px-4 py-3">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-neutral-700" />
        </Link>
        <h1 className="text-base font-bold text-neutral-800">Zupona Points</h1>
      </header>
      <main className="flex-1 px-4 pt-4">
        <div className="rounded-2xl bg-brand-darkest p-5 text-white">
          <p className="text-xs text-white/70">Your balance</p>
          <div className="mt-1 flex items-center gap-2">
            <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
            <span className="text-3xl font-bold">{user.points}</span>
            <span className="text-sm text-white/70">pts</span>
          </div>
          <p className="mt-2 text-xs text-white/60">Earn 1 point for every ৳50 you spend.</p>
        </div>

        <h2 className="mb-2 mt-5 text-sm font-bold text-neutral-800">History</h2>
        {earningOrders.length === 0 ? (
          <p className="text-xs text-neutral-400">Place an order to start earning points.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {earningOrders.map((order) => (
              <div key={order.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-800">Order {order.orderNumber}</p>
                  <p className="text-xs text-neutral-400">
                    {new Date(`${order.placedAt.replace(" ", "T")}Z`).toLocaleDateString("en-US", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
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
