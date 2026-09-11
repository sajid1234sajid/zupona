import { Check } from "lucide-react";
import type { OrderStep } from "@/types";

/** The four milestones the confirmation screen shows on one horizontal rail. */
const SHOWN = ["placed", "confirmed", "out_for_delivery", "delivered"] as const;

function formatAt(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · ${date.toLocaleTimeString(
    "en-US",
    { hour: "2-digit", minute: "2-digit" }
  )}`;
}

export default function OrderProgress({ steps, eta }: { steps: OrderStep[]; eta: string }) {
  const shown = SHOWN.map((status) => steps.find((step) => step.status === status)).filter(
    (step): step is OrderStep => Boolean(step)
  );

  return (
    <div className="flex items-start">
      {shown.map((step, index) => {
        const next = shown[index + 1];
        return (
          <div key={step.status} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-14 shrink-0 flex-col items-center gap-1 text-center">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  step.done ? "bg-brand text-white" : "border-2 border-line bg-white text-ink-faint"
                }`}
              >
                {step.done ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
                )}
              </span>
              <span
                className={`text-[9px] font-semibold leading-tight ${
                  step.done ? "text-brand-darkest" : "text-ink-slate"
                }`}
              >
                {step.label}
              </span>
              <span className="text-[8px] leading-tight text-ink-slate">
                {formatAt(step.at, step.status === "delivered" ? eta : "Pending")}
              </span>
            </div>

            {next && (
              <span
                className={`mt-3 h-0.5 flex-1 rounded-full ${next.done ? "bg-brand" : "bg-line"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
