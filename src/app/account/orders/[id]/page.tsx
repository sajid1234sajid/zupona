import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, CreditCard } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getOrder } from "@/lib/orders";
import { formatPrice } from "@/lib/format";
import OrderTracker from "@/components/order/OrderTracker";

export default async function OrderDetailPage({ params }: PageProps<"/account/orders/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const order = await getOrder(user.id, id);

  if (!order) notFound();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#f3f5f4] pb-10">
      <header className="flex items-center gap-3 border-b border-neutral-100 bg-white px-4 py-3">
        <Link href="/account/orders" aria-label="Back to orders">
          <ChevronLeft className="h-5 w-5 text-neutral-700" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-neutral-800">Order {order.orderNumber}</h1>
          <p className="text-xs text-neutral-400">{order.currentStepLabel}</p>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-neutral-800">Order Tracking</h2>
          <OrderTracker steps={order.steps} />
        </section>

        <section className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-neutral-800">
            <MapPin className="h-4 w-4 text-brand" />
            Delivery Address
          </h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
              {order.addressLabel}
            </span>
            <p className="text-sm font-semibold text-neutral-800">{order.addressFullName}</p>
          </div>
          <p className="mt-1 text-xs text-neutral-500">{order.addressPhone}</p>
          <p className="text-xs text-neutral-500">
            {[order.addressLine, order.addressArea, order.addressCity].filter(Boolean).join(", ")}
          </p>
        </section>

        <section className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-neutral-800">
            <CreditCard className="h-4 w-4 text-brand" />
            Payment Method
          </h2>
          <p className="text-sm text-neutral-600">{order.paymentLabel}</p>
        </section>

        <section className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-neutral-800">Items</h2>
          <div className="flex flex-col gap-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                  <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-800">{item.name}</p>
                  {item.color && <p className="text-xs text-neutral-400">Color: {item.color}</p>}
                  <p className="text-xs text-neutral-400">Qty {item.quantity}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-neutral-900">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}

            <div className="mt-1 flex items-center justify-between border-t border-neutral-100 pt-2 text-sm text-neutral-500">
              <span>Subtotal</span>
              <span className="font-semibold text-neutral-800">{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-neutral-500">
              <span>Shipping</span>
              <span className="font-semibold text-neutral-800">
                {order.shippingFee === 0 ? "Free" : formatPrice(order.shippingFee)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 pt-2 text-sm font-bold text-neutral-900">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
            <p className="text-xs text-brand">+{order.pointsEarned} points earned</p>
          </div>
        </section>
      </main>
    </div>
  );
}
