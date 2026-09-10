import { RotateCcw, ShieldCheck, Truck } from "lucide-react";

export interface DeliveryLine {
  label: string;
  value: string;
}

/** Delivery, returns and warranty, kept to one quiet card.
 *
 * The delivery figures come from the shop's own settings rather than being
 * written here, so the fee quoted on a product is the fee charged at checkout.
 * Return policy and warranty are per product and simply do not appear on a
 * product that has none. */
export default function DeliveryCard({
  lines,
  returnPolicy,
  warranty,
}: {
  lines: DeliveryLine[];
  returnPolicy: string | null;
  warranty: string | null;
}) {
  const extras = [
    returnPolicy ? { icon: RotateCcw, text: returnPolicy } : null,
    warranty ? { icon: ShieldCheck, text: warranty } : null,
  ].filter(Boolean) as { icon: typeof RotateCcw; text: string }[];

  if (lines.length === 0 && extras.length === 0) return null;

  return (
    <section
      aria-label="Delivery and returns"
      className="mt-4 rounded-2xl border border-[#dbeae4] bg-white p-4"
    >
      <h2 className="flex items-center gap-2 text-sm font-bold text-brand">
        <Truck className="h-4 w-4" aria-hidden />
        Delivery
      </h2>

      <dl>
        {lines.map((line) => (
          <div
            key={line.label}
            className="mt-2.5 flex items-center justify-between gap-3 border-t border-dashed border-[#dce9e4] pt-2.5 text-xs"
          >
            <dt className="text-ink-soft">{line.label}</dt>
            <dd className="font-semibold text-heading">{line.value}</dd>
          </div>
        ))}
      </dl>

      {extras.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-dashed border-[#dce9e4] pt-3">
          {extras.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-1.5 text-xs font-semibold text-brand-dark">
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
