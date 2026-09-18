import { CheckCircle2 } from "lucide-react";
import type { OrderStep } from "@/types";
import { SHOP_TIME_ZONE } from "@/lib/format";

function formatStepDate(iso: string | null): string {
  if (!iso) return "Pending";
  return new Date(iso).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: SHOP_TIME_ZONE,
  });
}

export default function OrderTracker({ steps }: { steps: OrderStep[] }) {
  return (
    <div className="flex flex-col">
      {steps.map((step, index) => (
        <div key={step.status} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                step.done ? "bg-brand text-white" : "bg-brand-mist text-ink-faint"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
            </span>
            {index !== steps.length - 1 && (
              <span className={`w-0.5 flex-1 ${step.done ? "bg-brand" : "bg-line"}`} />
            )}
          </div>
          <div className={`pb-6 ${step.done ? "" : "opacity-50"}`}>
            <p className="text-sm font-semibold text-heading">{step.label}</p>
            <p className="text-xs text-ink-slate">{formatStepDate(step.at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
