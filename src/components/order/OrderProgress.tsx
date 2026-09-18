import { Check, Truck } from "lucide-react";
import type { OrderStep } from "@/types";
import { SHOP_TIME_ZONE } from "@/lib/format";

/** The four milestones the confirmation screen shows on one horizontal rail. */
const SHOWN = ["placed", "confirmed", "out_for_delivery", "delivered"] as const;

function formatAt(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  // "Sept" is en-GB's only four-letter short month, and on a rail this narrow
  // it is the difference between one line and two.
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: SHOP_TIME_ZONE }).replace("Sept", "Sep");
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: SHOP_TIME_ZONE });
  return `${day} · ${time}`;
}

export default function OrderProgress({ steps, eta }: { steps: OrderStep[]; eta: string }) {
  const shown = SHOWN.map((status) => steps.find((step) => step.status === status)).filter(
    (step): step is OrderStep => Boolean(step)
  );

  // The first milestone that has not happened yet is the one the order is
  // working towards. The reference marks it with its number rather than a dot,
  // so the rail reads "three done, this one next" at a glance instead of
  // leaving the customer to count filled circles.
  const currentIndex = shown.findIndex((step) => !step.done);

  return (
    <div className="flex items-start">
      {shown.map((step, index) => {
        const next = shown[index + 1];
        const current = index === currentIndex;
        const last = index === shown.length - 1;

        return (
          <div key={step.status} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-[66px] shrink-0 flex-col items-center gap-1 text-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                  step.done
                    ? "bg-brand text-white"
                    : current
                      ? "bg-brand text-white"
                      : "bg-line text-ink-slate"
                }`}
              >
                {step.done ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : current ? (
                  index + 1
                ) : last ? (
                  <Truck className="h-3.5 w-3.5" strokeWidth={2.25} />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={`text-[10px] font-bold leading-tight ${
                  step.done || current ? "text-brand-darkest" : "text-ink-slate"
                }`}
              >
                {step.label}
              </span>
              <span className="text-[9px] leading-tight text-ink-slate">
                {formatAt(step.at, step.status === "delivered" ? eta : "Pending")}
              </span>
            </div>

            {next && (
              <span
                className={`mt-3.5 h-[3px] flex-1 rounded-full ${next.done ? "bg-brand" : "bg-line"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
