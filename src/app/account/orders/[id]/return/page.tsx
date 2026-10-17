import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, RotateCcw } from "lucide-react";
import DesktopHeader from "@/components/layout/DesktopHeader";
import ReturnForm from "@/components/order/ReturnForm";
import { requireUser } from "@/lib/session";
import { returnEligibility } from "@/lib/returns";
import { getSupportContact, waLink } from "@/lib/contact";
import { SHOP_TIME_ZONE } from "@/lib/format";

export const metadata = { title: "Request a return", robots: { index: false } };

/** Ask to return items from a delivered order: which items and how many,
 * why, photos, and how the shopper wants it settled. */
export default async function RequestReturnPage({ params }: PageProps<"/account/orders/[id]/return">) {
  const user = await requireUser();
  const { id } = await params;
  const [eligibility, contact] = await Promise.all([returnEligibility(user.id, id), getSupportContact()]);
  if (!eligibility) notFound();
  const { order } = eligibility;

  const deadline = eligibility.deadline
    ? new Date(eligibility.deadline).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: SHOP_TIME_ZONE,
      })
    : null;
  const helpHref = waLink(contact.whatsapp, `Hi, I need help with a return for order ${order.orderNumber}.`);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-brand-mist pb-10 tab:max-w-none tab:pb-12">
      <DesktopHeader />
      <header className="flex items-center gap-3 border-b border-line-soft bg-white px-4 py-3 tab:mx-auto tab:mt-6 tab:w-full tab:max-w-2xl tab:rounded-2xl tab:border">
        <Link href={`/account/orders/${order.id}`} aria-label="Back to the order">
          <ChevronLeft className="h-5 w-5 text-ink" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-heading">Request a return</h1>
          <p className="text-xs text-ink-slate">Order {order.orderNumber}</p>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 tab:mx-auto tab:w-full tab:max-w-2xl tab:px-0">
        {eligibility.open ? (
          <>
            {deadline ? (
              <p className="mb-3 flex items-center gap-2 rounded-xl bg-badge-bg px-3 py-2 text-[12.5px] font-semibold text-heading">
                <RotateCcw className="h-4 w-4 shrink-0 text-brand" />
                You can ask for a return until {deadline} ({eligibility.windowDays} days from delivery).
              </p>
            ) : null}
            <ReturnForm
              orderId={order.id}
              lines={eligibility.lines.filter((line) => line.remaining > 0)}
              changedMindAllowed={eligibility.changedMindAllowed}
            />
          </>
        ) : (
          <div className="rounded-2xl bg-white p-5 text-center shadow-card">
            <RotateCcw className="mx-auto h-8 w-8 text-ink-faint" />
            <p className="mt-2 text-sm font-semibold text-heading">{eligibility.blocked}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                href="/account/returns"
                className="inline-flex min-h-10 items-center rounded-xl border border-brand px-4 text-[12.5px] font-bold text-brand-darkest"
              >
                My returns
              </Link>
              <a
                href={helpHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-[12.5px] font-bold text-ink"
              >
                Ask us on WhatsApp
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
