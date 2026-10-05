import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Wallet } from "lucide-react";
import { getCurrentSeller } from "@/lib/sellers";
import { getSellerOrder, nextSellerSteps } from "@/lib/sellerCenter";
import { formatDateTime, formatPrice } from "@/lib/format";
import { resizedSrc } from "@/lib/image";
import { Card, CardHeader, PageHeader, StatusPill, Thumb, statusLabel } from "@/components/admin/ui";
import { Row } from "@/components/seller/ui";
import OrderStepPanel from "@/components/seller/OrderStepPanel";

export const metadata = { title: "Order" };

export default async function SellerOrderPage(props: PageProps<"/seller/orders/[id]">) {
  const { id } = await props.params;
  const seller = await getCurrentSeller();
  if (!seller) notFound();

  const order = await getSellerOrder(seller.id, decodeURIComponent(id));
  if (!order) notFound();

  const steps = nextSellerSteps(order.status, order.soleSeller);
  const address = [order.customer.line, order.customer.area, order.customer.district, order.customer.city]
    .filter(Boolean)
    .join(", ");
  const collect = order.paymentStatus !== "paid" && /cash|cod/i.test(order.paymentLabel);

  return (
    <>
      <PageHeader
        title={`Order #${order.orderNumber}`}
        subtitle={`Placed ${formatDateTime(order.placedAt)}`}
        breadcrumb={["Orders", `#${order.orderNumber}`]}
        action={
          <Link href="/seller/orders" className="flex items-center gap-1 text-[13px] font-semibold text-brand">
            <ArrowLeft className="h-4 w-4" />
            All orders
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-7">
          <Card>
            <CardHeader
              title="Items to send"
              subtitle={
                order.soleSeller
                  ? "Everything in this order is from your store"
                  : "This order also has items from other sellers — only yours are shown"
              }
              action={<StatusPill status={order.status} />}
            />
            <ul className="divide-y divide-neutral-100">
              {order.lines.map((line) => (
                <li key={line.id} className="flex items-center gap-3 py-3">
                  <Thumb src={resizedSrc(line.image, 128)} alt="" size={56} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[14px] font-semibold text-neutral-800">{line.name}</p>
                    {line.option ? (
                      <p className="mt-0.5 text-[12px] text-neutral-500">{line.option}</p>
                    ) : null}
                    <p className="mt-0.5 text-[12px] text-neutral-400">
                      {formatPrice(line.price)} × {line.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 text-[14px] font-bold text-neutral-900">
                    {formatPrice(line.price * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 divide-y divide-neutral-100 border-t border-neutral-100 text-sm">
              <Row label="Your items">{formatPrice(order.subtotal)}</Row>
              <Row label={`Zupona commission (${seller.commissionRate}%)`}>
                <span className="text-red-600">−{formatPrice(order.commission)}</span>
              </Row>
              <Row label="You earn" strong>
                <span className="text-brand">{formatPrice(order.status === "cancelled" ? 0 : order.net)}</span>
              </Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            {order.history.length === 0 ? (
              <p className="text-sm text-neutral-400">No updates yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-neutral-200 pl-5">
                {order.history.map((entry, index) => (
                  <li key={`${entry.createdAt}-${index}`} className="relative">
                    <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand" />
                    <p className="text-[13px] font-semibold text-neutral-800">{statusLabel(entry.status)}</p>
                    {entry.note ? <p className="text-[12px] text-neutral-500">{entry.note}</p> : null}
                    <p className="text-[11px] text-neutral-400">{formatDateTime(entry.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5 xl:col-span-5">
          <Card>
            <CardHeader title="What to do next" />
            <OrderStepPanel
              suborderId={order.suborderId}
              steps={steps}
              courier={order.courier}
              tracking={order.tracking}
              soleSeller={order.soleSeller}
            />
          </Card>

          <Card>
            <CardHeader title="Deliver to" />
            <div className="space-y-3 text-sm">
              <p className="font-semibold text-neutral-900">{order.customer.name}</p>
              <p className="flex items-start gap-2 text-neutral-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                {address}
              </p>
              <a
                href={`tel:${order.customer.phone}`}
                className="flex items-center gap-2 font-medium text-brand hover:underline"
              >
                <Phone className="h-4 w-4 shrink-0" />
                {order.customer.phone}
              </a>
              <p className="flex items-center gap-2 text-neutral-600">
                <Wallet className="h-4 w-4 shrink-0 text-neutral-400" />
                {order.paymentLabel}
                <StatusPill status={order.paymentStatus} />
              </p>
              {collect && order.status !== "cancelled" ? (
                <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-800">
                  Cash on delivery — the courier collects the order total from the customer.
                </p>
              ) : null}
              {order.courier || order.tracking ? (
                <p className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-[12px] text-neutral-600">
                  {order.courier ?? "Courier"}
                  {order.tracking ? ` · ${order.tracking}` : ""}
                  {order.shippedAt ? ` · shipped ${formatDateTime(order.shippedAt)}` : ""}
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
