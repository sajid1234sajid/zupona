import Link from "next/link";
import DesktopHeader from "@/components/layout/DesktopHeader";
import Image from "@/components/ui/StoreImage";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, CreditCard, BadgeCheck, PenLine, PackageOpen, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getOrder } from "@/lib/orders";
import { getOrderReviewStates } from "@/lib/reviews";
import { orderReturns } from "@/lib/returns";
import { RETURN_STATUS_LABELS } from "@/lib/returnOptions";
import { formatPrice } from "@/lib/format";
import OrderTracker from "@/components/order/OrderTracker";

export default async function OrderDetailPage({ params }: PageProps<"/account/orders/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  // The order, its review states and its returns are independent reads.
  const [order, reviewStates, returns] = await Promise.all([
    getOrder(user.id, id),
    getOrderReviewStates(user.id, id),
    orderReturns(user.id, id),
  ]);

  if (!order) notFound();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-10 tab:max-w-none tab:pb-12">
      <DesktopHeader />
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3 tab:mx-auto tab:mt-6 tab:w-full tab:max-w-2xl tab:rounded-2xl tab:border">
        <Link href="/account/orders" aria-label="Back to orders">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-heading">Order {order.orderNumber}</h1>
          <p className="text-xs text-ink-slate">{order.currentStepLabel}</p>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-2xl tab:px-0">
        <section className="rounded-2xl bg-white p-4 shadow-card">
          <h2 className="mb-3 text-sm font-bold text-heading">Order Tracking</h2>
          <OrderTracker steps={order.steps} />
        </section>

        <section className="mt-3 rounded-2xl bg-white p-4 shadow-card">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-heading">
            <MapPin className="h-4 w-4 text-brand" />
            Delivery Address
          </h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
              {order.addressLabel}
            </span>
            <p className="text-sm font-semibold text-heading">{order.addressFullName}</p>
          </div>
          <p className="mt-1 text-xs text-ink-slate">{order.addressPhone}</p>
          <p className="text-xs text-ink-slate">
            {[order.addressLine, order.addressArea, order.addressCity].filter(Boolean).join(", ")}
          </p>
        </section>

        <section className="mt-3 rounded-2xl bg-white p-4 shadow-card">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-heading">
            <CreditCard className="h-4 w-4 text-brand" />
            Payment Method
          </h2>
          <p className="text-sm text-ink-slate">{order.paymentLabel}</p>
        </section>

        <section className="mt-3 rounded-2xl bg-white p-4 shadow-card">
          <h2 className="mb-2 text-sm font-bold text-heading">Items</h2>
          <div className="flex flex-col gap-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-mist">
                  <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-heading">{item.name}</p>
                  {item.color && <p className="text-xs text-ink-slate">Color: {item.color}</p>}
                  <p className="text-xs text-ink-slate">Qty {item.quantity}</p>
                  {(() => {
                    const review = reviewStates.get(item.id);
                    if (review?.state === "reviewed") {
                      return (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-brand">
                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                          Reviewed
                        </p>
                      );
                    }
                    if (review?.state === "reviewable" && review.slug) {
                      return (
                        <Link
                          href={`/products/${review.slug}#write-review`}
                          className="mt-1.5 inline-flex min-h-[32px] items-center gap-1 rounded-full border border-brand px-3 text-[11px] font-bold text-brand"
                        >
                          <PenLine className="h-3.5 w-3.5" aria-hidden />
                          Write a review
                        </Link>
                      );
                    }
                    return null;
                  })()}
                </div>
                <span className="shrink-0 text-sm font-bold text-heading">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}

            <div className="mt-1 flex items-center justify-between border-t border-line-soft pt-2 text-sm text-ink-slate">
              <span>Subtotal</span>
              <span className="font-semibold text-heading">{formatPrice(order.subtotal)}</span>
            </div>
            {order.discountTotal > 0 ? (
              <div className="flex items-center justify-between text-sm text-ink-slate">
                <span>Discount{order.couponCode ? ` (${order.couponCode} / points)` : " (points)"}</span>
                <span className="font-semibold text-success">−{formatPrice(order.discountTotal)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-sm text-ink-slate">
              <span>Shipping</span>
              <span className="font-semibold text-heading">
                {order.shippingFee === 0 ? "Free" : formatPrice(order.shippingFee)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-line-soft pt-2 text-sm font-bold text-heading">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
            {order.pointsEarned > 0 ? (
              <p className="text-xs text-brand">
                {order.status === "delivered"
                  ? `+${order.pointsEarned} points earned`
                  : order.status === "cancelled"
                    ? "No points for a cancelled order"
                    : `+${order.pointsEarned} points when delivered`}
              </p>
            ) : null}
          </div>
        </section>

        {order.status === "delivered" || returns.length > 0 ? (
          <section className="mt-3 rounded-2xl bg-white p-4 shadow-card">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-heading">
              <PackageOpen className="h-4 w-4 text-brand" />
              Returns
            </h2>
            {returns.length > 0 ? (
              <ul className="mb-3 flex flex-col gap-1.5">
                {returns.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="min-w-0 truncate text-ink">
                      {entry.quantity > 1 ? `${entry.quantity} × ` : ""}
                      {entry.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-bold text-brand-dark">
                      {RETURN_STATUS_LABELS[entry.status]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {order.status === "delivered" ? (
                <Link
                  href={`/account/orders/${order.id}/return`}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-brand px-3.5 text-[12px] font-bold text-brand-darkest"
                >
                  <PackageOpen className="h-4 w-4" /> Request a return
                </Link>
              ) : null}
              {returns.length > 0 ? (
                <Link
                  href="/account/returns"
                  className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-line px-3.5 text-[12px] font-bold text-ink"
                >
                  Follow my returns <ChevronRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
