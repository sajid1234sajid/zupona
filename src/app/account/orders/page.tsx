import Link from "next/link";
import { ChevronLeft, Package } from "lucide-react";
import BottomNav from "@/components/layout/BottomNav";
import OrderCard from "@/components/order/OrderCard";
import { requireUser } from "@/lib/session";
import { getOrders } from "@/lib/orders";

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await getOrders(user.id);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#f3f5f4] pb-20">
      <header className="flex items-center gap-3 border-b border-neutral-100 bg-white px-4 py-3">
        <Link href="/account" aria-label="Back to account">
          <ChevronLeft className="h-5 w-5 text-neutral-700" />
        </Link>
        <h1 className="text-base font-bold text-neutral-800">My Orders</h1>
      </header>
      <main className="flex-1 px-4 pt-4">
        {orders.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint">
              <Package className="h-7 w-7 text-brand" />
            </span>
            <p className="text-sm font-semibold text-neutral-700">No orders yet</p>
            <p className="max-w-xs text-xs text-neutral-400">
              Your orders will show up here once you place one.
            </p>
            <Link href="/" className="mt-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
