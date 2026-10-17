import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOrder } from "@/lib/orders";
import { getSupportContact, formatWhatsapp } from "@/lib/contact";
import { formatAddressLine, formatPrice, SHOP_TIME_ZONE } from "@/lib/format";
import PrintButton from "./PrintButton";

export const metadata: Metadata = { title: "Invoice — Zupona", robots: { index: false } };

/** A printable invoice for one of the shopper's own orders. The browser's
 * "Save as PDF" turns it into a file; nothing is generated on the server. */
export default async function InvoicePage({ params }: PageProps<"/account/orders/[id]/invoice">) {
  const user = await requireUser();
  const { id } = await params;
  const [order, contact] = await Promise.all([getOrder(user.id, id), getSupportContact()]);
  if (!order) notFound();

  const placed = new Date(`${order.placedAt.replace(" ", "T")}Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SHOP_TIME_ZONE,
  });

  return (
    <main className="mx-auto w-full max-w-3xl bg-white p-6 text-[13px] text-ink print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/account/orders/${order.id}`} className="text-[13px] font-semibold text-brand">
          ← Back to order
        </Link>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between border-b border-line pb-4">
        <div>
          <p className="text-2xl font-extrabold text-brand-darkest">Zupona</p>
          <p className="text-ink-muted">zupona.com</p>
          <p className="text-ink-muted">WhatsApp {formatWhatsapp(contact.whatsapp)}</p>
          {contact.email ? <p className="text-ink-muted">{contact.email}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">Invoice</p>
          <p>Order {order.orderNumber}</p>
          <p className="text-ink-muted">{placed}</p>
          <p className="text-ink-muted">{order.paymentLabel}</p>
        </div>
      </header>

      <section className="mt-4">
        <p className="font-semibold">Delivered to</p>
        <p>{order.addressFullName}</p>
        <p>{order.addressPhone}</p>
        <p className="text-ink-muted">
          {formatAddressLine({
            line1: order.addressLine,
            area: order.addressArea,
            district: order.addressDistrict,
            city: order.addressCity,
          })}
        </p>
      </section>

      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="border-b border-line text-left text-[12px] uppercase tracking-wide text-ink-muted">
            <th className="py-2">Item</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-line-soft">
              <td className="py-2">
                {item.name}
                {item.color ? <span className="text-ink-muted"> · {item.color}</span> : null}
              </td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">{formatPrice(item.price)}</td>
              <td className="py-2 text-right">{formatPrice(item.price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-4 w-full max-w-xs space-y-1">
        <div className="flex justify-between">
          <dt>Items</dt>
          <dd>{formatPrice(order.subtotal)}</dd>
        </div>
        {order.discountTotal > 0 ? (
          <div className="flex justify-between">
            <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
            <dd>−{formatPrice(order.discountTotal)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt>Delivery</dt>
          <dd>{order.shippingFee === 0 ? "Free" : formatPrice(order.shippingFee)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-1.5 text-[15px] font-bold">
          <dt>Total</dt>
          <dd>{formatPrice(order.total)}</dd>
        </div>
      </dl>

      <p className="mt-8 text-[11.5px] text-ink-muted">
        Thank you for shopping with Zupona. Questions about this order? Message us on WhatsApp with
        the order number.
      </p>
    </main>
  );
}
