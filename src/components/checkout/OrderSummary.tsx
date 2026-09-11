import Image from "next/image";
import { ReceiptText } from "lucide-react";
import { formatPrice } from "@/lib/format";

export interface SummaryLine {
  id: string;
  name: string;
  image: string;
  color: string | null;
  quantity: number;
  price: number;
  oldPrice: number;
}

interface OrderSummaryProps {
  lines: SummaryLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  subtitle: string;
  /** Bare layout (no card chrome) for embedding inside another card. */
  bare?: boolean;
}

export default function OrderSummary({
  lines,
  subtotal,
  deliveryFee,
  total,
  subtitle,
  bare = false,
}: OrderSummaryProps) {
  const body = (
    <>
      <div className="flex flex-col gap-3">
        {lines.map((line) => {
          const saved = Math.max(0, (line.oldPrice - line.price) * line.quantity);
          const discount =
            line.oldPrice > line.price ? Math.round(((line.oldPrice - line.price) / line.oldPrice) * 100) : 0;

          return (
            <div key={line.id} className="flex gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-mist">
                <Image src={line.image} alt={line.name} fill sizes="56px" className="object-cover" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-ink-strong">{line.name}</p>
                <p className="mt-0.5 text-[11px] text-ink-slate">
                  {[line.color, `Qty ${line.quantity}`].filter(Boolean).join(" · ")}
                </p>
                {saved > 0 && (
                  <span className="mt-1 inline-block rounded-md bg-brand-tint px-1.5 py-0.5 text-[9px] font-semibold text-brand-dark">
                    You save {formatPrice(saved)}
                  </span>
                )}
              </div>

              <div className="shrink-0 text-right">
                {discount > 0 && (
                  <span className="mb-0.5 inline-block rounded-md bg-brand px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {discount}% OFF
                  </span>
                )}
                {line.oldPrice > line.price && (
                  <p className="text-[10px] text-ink-slate line-through">
                    {formatPrice(line.oldPrice * line.quantity)}
                  </p>
                )}
                <p className="text-sm font-bold text-brand-darkest">
                  {formatPrice(line.price * line.quantity)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-1.5 border-t border-dashed border-line pt-3">
        <div className="flex items-center justify-between text-[11px] text-ink-slate">
          <span>Item price (after discount)</span>
          <span className="font-semibold text-ink-strong">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-ink-slate">
          <span>Delivery charge</span>
          <span className="font-semibold text-ink-strong">{formatPrice(deliveryFee)}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-line px-1 pt-2.5">
        <span className="text-sm font-bold text-brand-darkest">Total</span>
        <span className="text-base font-extrabold text-brand-darkest">{formatPrice(total)}</span>
      </div>
    </>
  );

  if (bare) return body;

  return (
    <section className="rounded-2xl border border-line-soft bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
          <ReceiptText className="h-4 w-4 text-brand" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-ink-strong">Order summary</h2>
          <p className="text-[10px] text-ink-slate">{subtitle}</p>
        </div>
      </div>
      {body}
    </section>
  );
}
