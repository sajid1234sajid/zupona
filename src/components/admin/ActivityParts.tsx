import Link from "next/link";
import { EVENT_LABELS, sourceLabel, type FeedRow, type Person } from "@/lib/activityData";
import { formatPrice } from "@/lib/format";
import { Avatar, Thumb } from "@/components/admin/ui";

/* The pieces Admin -> Activity's two pages share: a person, an event, and
 * what the event was about. */

/** Uploaded pictures are resized by the media route when asked for a width. */
export function thumb(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/api/media/") ? `${url}${url.includes("?") ? "&" : "?"}w=96` : url;
}

export function visitorHref(visitorId: string): string {
  return `/admin/activity/${encodeURIComponent(visitorId)}`;
}

const EVENT_TONES: Record<string, string> = {
  product_view: "bg-sky-50 text-sky-700",
  cart_view: "bg-neutral-100 text-neutral-600",
  checkout: "bg-violet-50 text-violet-700",
  add_to_cart: "bg-amber-50 text-amber-700",
  buy_now: "bg-orange-50 text-orange-700",
  purchase: "bg-emerald-50 text-emerald-700",
  page_view: "bg-neutral-100 text-neutral-600",
};

export function EventPill({ event }: { event: string }) {
  return (
    <span
      className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        EVENT_TONES[event] ?? "bg-neutral-100 text-neutral-600"
      }`}
    >
      {EVENT_LABELS[event] ?? event}
    </span>
  );
}

/** What a row was about: the product, the order, or the page. */
export function EventSubject({ row }: { row: FeedRow }) {
  if (row.event === "purchase") {
    return (
      <span className="text-[13px] text-neutral-700">
        {row.orderId ? (
          <Link href={`/admin/orders/${row.orderId}`} className="font-semibold text-brand hover:underline">
            {row.orderNumber ?? "Order"}
          </Link>
        ) : (
          "Order"
        )}
        {row.value ? <span className="ml-1.5 font-semibold">{formatPrice(row.value)}</span> : null}
      </span>
    );
  }

  if (row.productId) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <Thumb src={thumb(row.productImage)} alt="" size={28} />
        <span className="min-w-0 truncate text-[13px] text-neutral-700">
          {row.productName ?? "A product that was removed"}
          {row.quantity && row.quantity > 1 ? <span className="text-neutral-400"> × {row.quantity}</span> : null}
          {row.value && row.event !== "product_view" ? (
            <span className="ml-1.5 font-semibold text-neutral-800">{formatPrice(row.value)}</span>
          ) : null}
        </span>
      </span>
    );
  }

  return (
    <span className="truncate text-[13px] text-neutral-500">{row.path === "/" ? "Home page" : (row.path ?? "")}</span>
  );
}

export function PersonCell({ person, visitorId }: { person: Person | undefined; visitorId: string }) {
  const name = person?.name ?? "Visitor";
  return (
    <Link href={visitorHref(visitorId)} className="flex min-w-0 items-center gap-2.5 hover:text-brand">
      <Avatar name={person?.known ? name : ""} size={30} />
      <span className="min-w-0">
        <span className={`block truncate text-[13px] font-semibold ${person?.known ? "text-neutral-800" : "text-neutral-500"}`}>
          {name}
        </span>
        <span className="block truncate text-[11px] text-neutral-400">
          {person?.phone ?? sourceLabel(person?.source ?? null)}
        </span>
      </span>
    </Link>
  );
}
