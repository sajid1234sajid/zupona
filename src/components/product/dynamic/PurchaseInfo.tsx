import { CalendarClock, RefreshCw, RotateCcw, ShieldCheck, Truck, Wallet } from "lucide-react";

export interface DeliveryLine {
  label: string;
  value: string;
}

/** Returns, exchange, delivery and payment, as one list of "Label : value" rows
 * under the quantity picker.
 *
 * Every row is backed by something real: the return and exchange windows by
 * the shop's settings (a 0 there hides the row), the delivery date by the
 * standard delivery window, the fees by the same settings checkout charges.
 * Per-product return policy and warranty only appear on products that have one. */
export default function PurchaseInfo({
  returnDays,
  exchangeDays,
  estimatedDelivery,
  deliveryLines,
  returnPolicy,
  warranty,
}: {
  returnDays: number;
  exchangeDays: number;
  /** e.g. "18–19 September", or null when no window is known. */
  estimatedDelivery: string | null;
  deliveryLines: DeliveryLine[];
  returnPolicy: string | null;
  warranty: string | null;
}) {
  const days = (n: number) => `${n} ${n === 1 ? "Day" : "Days"}`;

  const rows = [
    returnDays > 0 ? { icon: RotateCcw, label: "Return", value: days(returnDays) } : null,
    exchangeDays > 0 ? { icon: RefreshCw, label: "Exchange", value: days(exchangeDays) } : null,
    estimatedDelivery
      ? { icon: CalendarClock, label: "Estimated Delivery", value: estimatedDelivery }
      : null,
    ...deliveryLines.map((line) => ({ icon: Truck, label: line.label, value: line.value })),
    { icon: Wallet, label: "Payment", value: "Cash on Delivery Available" },
    returnPolicy ? { icon: RotateCcw, label: "Return Policy", value: returnPolicy } : null,
    warranty ? { icon: ShieldCheck, label: "Warranty", value: warranty } : null,
  ].filter(Boolean) as { icon: typeof Truck; label: string; value: string }[];

  return (
    <dl aria-label="Delivery and returns" className="space-y-2">
      {rows.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-start gap-2 text-[13px] leading-snug">
          <Icon className="mt-[1px] h-4 w-4 shrink-0 text-brand" aria-hidden />
          <dt className="shrink-0 text-ink-muted">{label} :</dt>
          <dd className="min-w-0 font-semibold text-heading">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
