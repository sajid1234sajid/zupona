import Link from "next/link";
import { CheckCircle2, ChevronLeft, RotateCcw } from "lucide-react";
import DesktopHeader from "@/components/layout/DesktopHeader";
import Image from "@/components/ui/StoreImage";
import { requireUser } from "@/lib/session";
import { myReturns } from "@/lib/returns";
import { formatPrice, SHOP_TIME_ZONE } from "@/lib/format";
import {
  reasonLabel,
  refundMethodLabel,
  resolutionLabel,
  returnSteps,
  RETURN_STATUS_LABELS,
} from "@/lib/returnOptions";

export const metadata = { title: "My returns", robots: { index: false } };

function shortDate(value: string): string {
  return new Date(`${value.replace(" ", "T")}Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: SHOP_TIME_ZONE,
  });
}

/** Every return the shopper has asked for, with where each one is. */
export default async function MyReturnsPage({ searchParams }: PageProps<"/account/returns">) {
  const user = await requireUser();
  const [returns, params] = await Promise.all([myReturns(user.id), searchParams]);
  const sent = params.sent === "1";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-10 tab:max-w-none tab:pb-12">
      <DesktopHeader />
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3 tab:mx-auto tab:mt-6 tab:w-full tab:max-w-2xl tab:rounded-2xl tab:border">
        <Link href="/account/orders" aria-label="Back to orders">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-base font-bold text-heading">Returns &amp; refunds</h1>
      </header>

      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-2xl tab:px-0">
        {sent ? (
          <p className="mb-3 flex items-center gap-2 rounded-xl bg-brand-tint px-3 py-2.5 text-[12.5px] font-semibold text-brand-dark">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Request sent. We&apos;ll reply within 2 working days.
          </p>
        ) : null}

        {returns.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-card">
            <RotateCcw className="mx-auto h-8 w-8 text-ink-faint" />
            <p className="mt-2 text-sm font-semibold text-heading">No returns yet</p>
            <p className="mt-1 text-xs text-ink-slate">
              To return something, open a delivered order and tap “Return”.
            </p>
            <Link
              href="/account/orders?tab=delivered"
              className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-brand px-4 text-[12.5px] font-bold text-brand-darkest"
            >
              Delivered orders
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {returns.map((entry) => {
              const steps = returnSteps(entry.status, entry.resolution);
              return (
                <li key={entry.id} className="rounded-2xl bg-white p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-mist">
                      <Image src={entry.image} alt="" fill sizes="56px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px] font-semibold text-heading">
                        {entry.quantity > 1 ? `${entry.quantity} × ` : ""}
                        {entry.name}
                      </p>
                      <p className="text-xs text-ink-slate">
                        <Link href={`/account/orders/${entry.orderId}`} className="font-semibold text-brand">
                          {entry.orderNumber}
                        </Link>{" "}
                        · asked {shortDate(entry.createdAt)} · {reasonLabel(entry.reason)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        entry.status === "rejected"
                          ? "bg-accent-red/10 text-accent-red"
                          : "bg-brand-tint text-brand-dark"
                      }`}
                    >
                      {RETURN_STATUS_LABELS[entry.status]}
                    </span>
                  </div>

                  <ol className="mt-3 flex items-center gap-1" aria-label="Return progress">
                    {steps.map((step, index) => (
                      <li key={step.label} className="flex flex-1 flex-col items-start gap-1">
                        <span
                          className={`h-1.5 w-full rounded-full ${
                            step.done ? (entry.status === "rejected" && index > 0 ? "bg-accent-red" : "bg-brand") : "bg-line"
                          }`}
                        />
                        <span
                          className={`text-[10.5px] leading-tight ${step.done ? "font-semibold text-heading" : "text-ink-faint"}`}
                        >
                          {step.label}
                        </span>
                      </li>
                    ))}
                  </ol>

                  <p className="mt-3 text-[12px] text-ink-slate">
                    {resolutionLabel(entry.resolution)}
                    {entry.resolution === "refund" && entry.refundMethod
                      ? ` to ${refundMethodLabel(entry.refundMethod)}`
                      : ""}{" "}
                    · {formatPrice(entry.refundAmount)}
                  </p>
                  {entry.note ? (
                    <p className="mt-1.5 rounded-lg bg-brand-mist px-3 py-2 text-[12px] text-ink">{entry.note}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
