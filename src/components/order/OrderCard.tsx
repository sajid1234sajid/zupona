import Link from "next/link";
import Image from "next/image";
import { Check, CreditCard, MapPin, Package } from "lucide-react";
import type { Order } from "@/types";
import { formatPrice } from "@/lib/format";

const STATUS_TONE: Record<string, string> = {
  placed: "bg-brand-mist text-ink-slate",
  confirmed: "bg-brand-tint text-brand-dark",
  shipped: "bg-brand-mist text-accent-amber",
  out_for_delivery: "bg-brand-tint text-brand-dark",
  delivered: "bg-brand-tint text-brand-dark",
  cancelled: "bg-accent-red/10 text-accent-red",
};

/** "Today"/"Tomorrow" while that is still true, a short date after that.
 *
 * The date itself is the estimate derived in `lib/orders.ts` from when the
 * order was placed -- there is no carrier feed behind it. */
function formatArrival(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}

/** One order, summarised: what was bought, what it cost, how far along it is.
 *
 * Shared by the account overview and the orders list, so it has to survive a
 * 320px screen. Every text column is `min-w-0` and truncating, which is what
 * keeps the status pill from pushing the page sideways -- the pill may not
 * shrink, so the title must. */
export default function OrderCard({ order }: { order: Order }) {
  const firstItem = order.items[0];
  const extraCount = order.items.length - 1;
  const arrival = formatArrival(order.estimatedDeliveryAt);
  const delivered = order.status === "delivered";
  const cancelled = order.status === "cancelled";

  const meta = [firstItem?.color, firstItem && `Qty ${firstItem.quantity}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-brand-darkest/[0.04]">
      <div className="flex items-start gap-3">
        {/* Decorative: the product name sits right beside it, so a second
            link to the same order would only add noise for a screen reader. */}
        <div className="relative h-[62px] w-[62px] shrink-0 overflow-hidden rounded-xl bg-brand-mist">
          {firstItem ? (
            <Image
              src={firstItem.image}
              alt=""
              fill
              sizes="62px"
              className="object-cover"
            />
          ) : (
            <span className="grid h-full w-full place-items-center text-ink-muted">
              <Package className="h-5 w-5" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-brand-darkest">
              {firstItem?.name ?? "Order"}
            </p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                STATUS_TONE[order.status] ?? STATUS_TONE.placed
              }`}
            >
              {order.currentStepLabel}
            </span>
          </div>

          <p className="mt-0.5 truncate text-[10.5px] text-ink-muted">
            {meta}
            {extraCount > 0 && `${meta ? " · " : ""}+${extraCount} more item${extraCount > 1 ? "s" : ""}`}
          </p>

          <p className="mt-1 truncate text-[10.5px] text-ink-muted">
            Order ID: <span className="font-semibold text-brand-darkest">{order.orderNumber}</span>
          </p>

          <div className="mt-1 flex items-end justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1 text-[10px] text-ink-muted">
              <CreditCard className="h-3 w-3 shrink-0" />
              <span className="truncate">{order.paymentLabel}</span>
            </span>
            <span className="shrink-0 text-[14px] font-extrabold text-brand-darkest">
              {formatPrice(order.total)}
            </span>
          </div>
        </div>
      </div>

      {!cancelled && arrival && (
        <p className="mt-2.5 flex items-center gap-1 rounded-lg bg-brand-mist px-2 py-1.5 text-[10.5px] font-semibold text-brand-dark">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {delivered ? `Delivered ${arrival}` : `Arriving ${arrival}`}
          </span>
        </p>
      )}

      {/* Five equal columns, so the rail cannot be wider than the card. */}
      <ol className="mt-3 grid grid-cols-5">
        {order.steps.map((step, index) => (
          <li
            key={step.status}
            className="relative flex min-w-0 flex-col items-center gap-1 px-0.5 text-center"
          >
            {index > 0 && (
              <span
                aria-hidden
                className={`absolute right-1/2 top-[8px] h-[2px] w-full rounded-full ${
                  step.done ? "bg-brand" : "bg-line"
                }`}
              />
            )}
            <span
              className={`relative grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ${
                step.done
                  ? "bg-brand text-white"
                  : "border-2 border-line bg-white text-ink-faint"
              }`}
            >
              {step.done ? (
                <Check className="h-2.5 w-2.5" strokeWidth={4} />
              ) : (
                <span className="h-1 w-1 rounded-full bg-ink-faint" />
              )}
            </span>
            <span
              className={`text-[7.5px] font-semibold leading-[1.2] break-words hyphens-auto ${
                step.done ? "text-brand-dark" : "text-ink-muted/70"
              }`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      <Link
        href={`/account/orders/${order.id}`}
        className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-brand bg-white px-3 text-[12px] font-bold text-brand-darkest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        Track Order
      </Link>
    </article>
  );
}
