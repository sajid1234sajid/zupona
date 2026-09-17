import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, MessageCircle, Phone, Truck, User } from "lucide-react";
import { getOrderDetail } from "@/lib/adminData";
import { deliveryMethodName } from "@/lib/checkout";
import { formatAddressLine, formatDateTime, formatPrice } from "@/lib/format";
import {
  Card,
  CardHeader,
  PageHeader,
  StatusPill,
  Td,
  Th,
  TableScroll,
  Thumb,
  buttonStyles,
  fieldStyles,
  statusLabel,
} from "@/components/admin/ui";
import { setOrderStatusAction, setPaymentStatusAction, setTrackingAction } from "../actions";

export async function generateMetadata(props: PageProps<"/admin/orders/[id]">) {
  const { id } = await props.params;
  const order = await getOrderDetail(id);
  return { title: order ? `Order #${order.orderNumber}` : "Order" };
}

const NEXT_STATUS: Record<string, string[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

const TIMELINE = ["placed", "confirmed", "shipped", "out_for_delivery", "delivered"];

export default async function OrderDetailPage(props: PageProps<"/admin/orders/[id]">) {
  const { id } = await props.params;
  const order = await getOrderDetail(id);
  if (!order) notFound();

  // Today an order has one fulfilment record; the form edits that one. When
  // several sellers are involved this becomes a per-seller form.
  const shipment = order.fulfilment[0] ?? null;

  const reachedIndex = TIMELINE.indexOf(order.status);
  const cancelled = order.status === "cancelled";

  // Cash on Delivery is how most of these are paid, and the number that has to
  // travel with the rider is the one thing the screen never said out loud.
  const codDue =
    !cancelled && order.paymentStatus !== "paid" && /cash on delivery/i.test(order.paymentLabel)
      ? order.total
      : 0;

  // The cost snapshot is taken at purchase precisely so margin survives later
  // price changes. Zero means the products had no cost recorded, in which case
  // a margin would be a fiction, so none is shown.
  const costTotal = order.items.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
  const margin = costTotal > 0 ? order.subtotal - order.discountTotal - costTotal : null;

  const returning = order.customerOrderCount > 1;

  return (
    <>
      <PageHeader
        title={`Order #${order.orderNumber}`}
        subtitle={`Placed ${formatDateTime(order.placedAt)}`}
        breadcrumb={["Orders", `#${order.orderNumber}`]}
        action={
          <Link href="/admin/orders" className={buttonStyles.secondary}>
            <ArrowLeft className="h-4 w-4" />
            All orders
          </Link>
        }
      />

      {codDue > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            <span className="font-bold">Collect {formatPrice(codDue)} on delivery</span> — cash on
            delivery, not yet marked paid.
          </p>
          <span className="text-[12px] text-amber-800">
            Mark the payment paid once the rider hands the cash over.
          </span>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-4 xl:col-span-8">
          <Card>
            <CardHeader
              title="Fulfillment"
              subtitle="Moving the order along notifies the customer"
              action={<StatusPill status={order.status} />}
            />

            {/* Progress rail. Cancelled orders show no progress at all rather
                than a half-finished track that implies it is still moving. */}
            <ol className="mb-5 flex items-center gap-1">
              {TIMELINE.map((step, index) => {
                const done = !cancelled && index <= reachedIndex;
                return (
                  <li key={step} className="min-w-0 flex-1">
                    <span
                      className={`block h-1.5 rounded-full ${done ? "bg-brand" : "bg-neutral-100"}`}
                    />
                    <span
                      className={`mt-1.5 block truncate text-[10px] ${
                        done ? "font-semibold text-brand-dark" : "text-neutral-400"
                      }`}
                    >
                      {statusLabel(step)}
                    </span>
                  </li>
                );
              })}
            </ol>

            {NEXT_STATUS[order.status]?.length ? (
              <div className="flex flex-wrap gap-2.5">
                {NEXT_STATUS[order.status].map((next) => (
                  <form key={next} action={setOrderStatusAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="status" value={next} />
                    <button
                      type="submit"
                      className={next === "cancelled" ? buttonStyles.danger : buttonStyles.primary}
                    >
                      Mark as {statusLabel(next)}
                    </button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-500">
                This order is {statusLabel(order.status).toLowerCase()} — no further steps.
              </p>
            )}

            <form
              action={setTrackingAction}
              className="mt-4 flex flex-wrap items-end gap-2.5 border-t border-neutral-100 pt-4"
            >
              <input type="hidden" name="orderId" value={order.id} />
              <label className="min-w-[9rem] flex-1">
                <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">
                  Courier
                </span>
                <input
                  key={`courier-${shipment?.courierName ?? ""}`}
                  name="courier"
                  defaultValue={shipment?.courierName ?? ""}
                  placeholder="Pathao, Steadfast…"
                  className={fieldStyles}
                />
              </label>
              <label className="min-w-[9rem] flex-1">
                <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">
                  Tracking number
                </span>
                <input
                  key={`tracking-${shipment?.trackingNumber ?? ""}`}
                  name="tracking"
                  defaultValue={shipment?.trackingNumber ?? ""}
                  placeholder="TRK123456"
                  className={fieldStyles}
                />
              </label>
              <button type="submit" className={buttonStyles.secondary}>
                <Truck className="h-4 w-4" />
                {shipment?.trackingNumber ? "Update tracking" : "Save tracking"}
              </button>
            </form>
          </Card>

          {/* Fulfilment: one block per seller, and one for an order that is
              entirely the platform's own goods. */}
          <Card>
            <CardHeader
              title={`Fulfilment (${order.fulfilment.length})`}
              subtitle="Who ships what, and where it has got to"
            />
            {order.fulfilment.length === 0 ? (
              <p className="rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-500">
                No fulfilment record yet — saving tracking will create one.
              </p>
            ) : (
              <ul className="space-y-3">
                {order.fulfilment.map((part) => (
                  <li key={part.id} className="rounded-xl border border-neutral-100 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-neutral-900">
                        {part.sellerName ?? "Zupona (platform)"}
                        <span className="ml-2 text-[12px] font-normal text-neutral-500">
                          {part.itemCount} item{part.itemCount === 1 ? "" : "s"}
                        </span>
                      </p>
                      <StatusPill status={part.status} />
                    </div>

                    <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-3">
                      <div>
                        <dt className="text-neutral-500">Courier</dt>
                        <dd className="font-medium text-neutral-800">{part.courierName ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Tracking</dt>
                        <dd className="font-medium text-neutral-800">
                          {part.trackingNumber ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Subtotal</dt>
                        <dd className="font-medium text-neutral-800">{formatPrice(part.subtotal)}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Delivery</dt>
                        <dd className="font-medium text-neutral-800">
                          {formatPrice(part.shippingFee)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Shipped</dt>
                        <dd className="font-medium text-neutral-800">
                          {part.shippedAt ? formatDateTime(part.shippedAt) : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Delivered</dt>
                        <dd className="font-medium text-neutral-800">
                          {part.deliveredAt ? formatDateTime(part.deliveredAt) : "—"}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={`Items (${order.items.length})`} />
            <TableScroll>
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <Th className="pl-4 lg:pl-3">Product</Th>
                    <Th>Variant</Th>
                    <Th>SKU</Th>
                    <Th className="text-right">Price</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="pr-4 text-right lg:pr-3">Subtotal</Th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-neutral-50 last:border-0">
                      <Td className="pl-4 lg:pl-3">
                        <div className="flex items-center gap-2.5">
                          <Thumb src={item.image} alt="" size={40} />
                          <Link
                            href={`/admin/products/${item.productId}`}
                            className="block max-w-[13rem] truncate font-medium text-neutral-800 hover:text-brand"
                          >
                            {item.name}
                          </Link>
                        </div>
                      </Td>
                      <Td className="text-neutral-500">{item.color || "—"}</Td>
                      <Td className="font-mono text-[12px] text-neutral-500">{item.sku || "—"}</Td>
                      <Td className="whitespace-nowrap text-right">{formatPrice(item.price)}</Td>
                      <Td className="text-right">{item.quantity}</Td>
                      <Td className="whitespace-nowrap pr-4 text-right font-semibold lg:pr-3">
                        {formatPrice(item.price * item.quantity)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>

            <dl className="mt-4 space-y-2 border-t border-neutral-100 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Subtotal</dt>
                <dd className="font-medium">{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">
                  Delivery ({deliveryMethodName(order.deliveryMethod)})
                </dt>
                <dd className="font-medium">{formatPrice(order.shippingFee)}</dd>
              </div>
              {order.discountTotal > 0 ? (
                <div className="flex justify-between text-emerald-600">
                  <dt>Discount {order.couponCode ? `(${order.couponCode})` : ""}</dt>
                  <dd className="font-medium">−{formatPrice(order.discountTotal)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-neutral-100 pt-2 text-base">
                <dt className="font-bold text-neutral-900">Total</dt>
                <dd className="font-bold text-neutral-900">{formatPrice(order.total)}</dd>
              </div>
              {margin !== null ? (
                <div className="flex justify-between border-t border-neutral-100 pt-2 text-[13px]">
                  <dt className="text-neutral-500">
                    Margin on goods{" "}
                    <span className="text-neutral-400">(cost {formatPrice(costTotal)})</span>
                  </dt>
                  <dd className={margin >= 0 ? "font-semibold text-brand-dark" : "font-semibold text-accent-red"}>
                    {formatPrice(margin)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Status history" />
            {order.history.length === 0 ? (
              <p className="py-4 text-sm text-neutral-400">
                No status changes recorded yet — this order is still as it was placed.
              </p>
            ) : (
              <ol className="space-y-3">
                {order.history.map((entry, index) => (
                  <li key={`${entry.status}-${entry.at}-${index}`} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-neutral-800">
                        {statusLabel(entry.status)}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        {formatDateTime(entry.at)}
                        {entry.by ? ` · by ${entry.by}` : ""}
                      </p>
                      {entry.note ? (
                        <p className="mt-0.5 text-[12px] text-neutral-600">{entry.note}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-4">
          <Card>
            <CardHeader title="Customer" />
            <div className="space-y-2.5 text-sm">
              <p className="flex items-center gap-2 text-neutral-700">
                <User className="h-4 w-4 shrink-0 text-neutral-400" />
                <Link
                  href={`/admin/customers/${order.customerId}`}
                  className="truncate font-medium hover:text-brand"
                >
                  {order.customerName}
                </Link>
              </p>
              {order.customerEmail ? (
                <p className="truncate pl-6 text-neutral-500">{order.customerEmail}</p>
              ) : null}
              <p className="flex items-center gap-2 text-neutral-700">
                <Phone className="h-4 w-4 shrink-0 text-neutral-400" />
                <a href={`tel:${order.addressPhone}`} className="font-medium hover:text-brand">
                  {order.addressPhone}
                </a>
              </p>

              {/* Cash-on-delivery orders get confirmed by phone before anyone
                  dispatches them, so the number is dialable and reachable on
                  WhatsApp straight from here rather than copied by hand. */}
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={`tel:${order.addressPhone}`} className={buttonStyles.secondary}>
                  <Phone className="h-4 w-4" />
                  Call
                </a>
                <a
                  href={`https://wa.me/${order.addressPhone.replace(/[^0-9]/g, "").replace(/^0/, "880")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonStyles.secondary}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </div>

              {/* First-timer or regular: worth knowing before the call, and
                  before a large cash-on-delivery order goes out. */}
              <dl className="mt-1 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 text-[12px]">
                <div className="bg-white px-2.5 py-2">
                  <dt className="text-[10.5px] text-neutral-500">Orders placed</dt>
                  <dd className="mt-0.5 font-medium text-neutral-800">
                    {order.customerOrderCount}
                    <span className={`ml-1.5 rounded px-1.5 py-px text-[10px] font-semibold ${
                      returning ? "bg-brand-tint text-brand-dark" : "bg-amber-100 text-amber-800"
                    }`}>
                      {returning ? "Returning" : "First order"}
                    </span>
                  </dd>
                </div>
                <div className="bg-white px-2.5 py-2">
                  <dt className="text-[10.5px] text-neutral-500">Spent with us</dt>
                  <dd className="mt-0.5 font-medium text-neutral-800">
                    {formatPrice(order.customerLifetimeValue)}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader title="Delivery address" />
            <p className="flex gap-2 text-sm text-neutral-700">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
              <span>
                <span className="block font-medium">{order.addressFullName}</span>
                <span className="block text-neutral-500">
                  {formatAddressLine({
                    line1: order.addressLine,
                    area: order.addressArea,
                    district: order.addressDistrict,
                    city: order.addressCity,
                  })}
                </span>
                <span className="mt-1 inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                  {order.addressLabel}
                </span>
              </span>
            </p>

            {/* The same address broken out, so the administrative path is
                readable at a glance -- which division, which district, which
                thana -- rather than having to be parsed out of one line.
                Orders placed before the district column existed say so instead
                of showing a blank. */}
            <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 text-[12px]">
              {[
                { label: "Division", value: order.addressCity },
                { label: "District", value: order.addressDistrict ?? "Not recorded" },
                { label: "Thana", value: order.addressArea ?? "Not recorded" },
              ].map((row) => (
                <div key={row.label} className="bg-white px-2.5 py-2">
                  <dt className="text-[10.5px] text-neutral-500">{row.label}</dt>
                  <dd className="mt-0.5 font-medium text-neutral-800">{row.value || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Payment" action={<StatusPill status={order.paymentStatus} />} />
            <p className="mb-3 text-sm text-neutral-600">{order.paymentLabel}</p>
            <form action={setPaymentStatusAction} className="flex items-center gap-2">
              <input type="hidden" name="orderId" value={order.id} />
              <select
                name="paymentStatus"
                defaultValue={order.paymentStatus}
                aria-label="Payment status"
                className={fieldStyles}
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
                <option value="partially_refunded">Partially refunded</option>
              </select>
              <button type="submit" className={buttonStyles.secondary}>
                Update
              </button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
