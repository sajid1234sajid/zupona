import Link from "next/link";
import Image from "@/components/ui/StoreImage";
import { requireStaff } from "@/lib/admin";
import { listReturns, NEXT_STATUSES } from "@/lib/returns";
import { formatDateTime, formatPrice } from "@/lib/format";
import {
  reasonLabel,
  refundMethodLabel,
  resolutionLabel,
  RETURN_REASONS,
  RETURN_STATUS_LABELS,
} from "@/lib/returnOptions";
import { Card, EmptyState, PageHeader, StatusPill } from "@/components/admin/ui";
import ReturnControls from "./ReturnControls";

export const metadata = { title: "Returns" };

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "closed", label: "Settled" },
  { key: "all", label: "All" },
] as const;

/** Every return request, open ones first and oldest first, each with what
 * the customer said and showed, and the next step to take on it. */
export default async function AdminReturnsPage(props: PageProps<"/admin/orders/returns">) {
  await requireStaff();
  const params = await props.searchParams;
  const raw = Array.isArray(params.show) ? params.show[0] : params.show;
  const show = FILTERS.find((filter) => filter.key === raw)?.key ?? "open";
  const returns = await listReturns(show);

  return (
    <>
      <PageHeader
        title="Returns"
        subtitle="Approve, collect, check and settle what customers send back"
        breadcrumb={["Orders", "Returns"]}
        action={
          <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
            {FILTERS.map((filter) => (
              <Link
                key={filter.key}
                href={filter.key === "open" ? "?" : `?show=${filter.key}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  filter.key === show ? "bg-white text-brand shadow-sm" : "text-neutral-500"
                }`}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        }
      />

      {returns.length === 0 ? (
        <Card>
          <EmptyState
            title={show === "open" ? "No open returns" : "No returns yet"}
            detail="Customers ask for a return from a delivered order in their account."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {returns.map((entry) => {
            const ourFault = RETURN_REASONS.find((reason) => reason.id === entry.reason)?.ourFault;
            const next = NEXT_STATUSES[entry.status];
            return (
              <Card key={entry.id}>
                <div className="flex items-start gap-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                    <Image src={entry.image} alt="" fill sizes="64px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-neutral-800">
                      {entry.quantity > 1 ? `${entry.quantity} × ` : ""}
                      {entry.name}
                      {entry.color ? <span className="font-normal text-neutral-400"> · {entry.color}</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      <Link href={`/admin/orders/${entry.orderId}`} className="font-semibold text-brand">
                        {entry.orderNumber}
                      </Link>{" "}
                      · {entry.customer.name}
                      {entry.customer.phone ? ` · ${entry.customer.phone}` : ""}
                    </p>
                    <p className="text-[11px] text-neutral-400">Asked {formatDateTime(entry.createdAt)}</p>
                  </div>
                  <StatusPill status={entry.status} label={RETURN_STATUS_LABELS[entry.status]} />
                </div>

                <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[12.5px]">
                  <dt className="text-neutral-400">Reason</dt>
                  <dd className="text-neutral-700">
                    {reasonLabel(entry.reason)}
                    <span className="text-neutral-400">
                      {ourFault ? " · our mistake, free pickup" : " · customer's choice"}
                    </span>
                  </dd>
                  <dt className="text-neutral-400">Wants</dt>
                  <dd className="text-neutral-700">
                    {resolutionLabel(entry.resolution)} · {formatPrice(entry.refundAmount)}
                  </dd>
                  {entry.resolution === "refund" && entry.refundAccount ? (
                    <>
                      <dt className="text-neutral-400">Refund to</dt>
                      <dd className="break-words text-neutral-700">
                        {refundMethodLabel(entry.refundMethod)} · {entry.refundAccount}
                      </dd>
                    </>
                  ) : null}
                  {entry.detail ? (
                    <>
                      <dt className="text-neutral-400">Customer says</dt>
                      <dd className="whitespace-pre-line text-neutral-700">{entry.detail}</dd>
                    </>
                  ) : null}
                  {entry.note ? (
                    <>
                      <dt className="text-neutral-400">Last note</dt>
                      <dd className="text-neutral-700">{entry.note}</dd>
                    </>
                  ) : null}
                </dl>

                {entry.photos.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.photos.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative h-20 w-20 overflow-hidden rounded-lg bg-neutral-100"
                      >
                        <Image src={url} alt="Customer's photo" fill sizes="80px" className="object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}

                {next.length > 0 ? (
                  <ReturnControls
                    id={entry.id}
                    next={next}
                    resolution={entry.resolution}
                    amount={entry.refundAmount}
                    most={entry.price * entry.quantity}
                  />
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
