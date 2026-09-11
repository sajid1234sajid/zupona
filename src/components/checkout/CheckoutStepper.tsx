"use client";

import { Check } from "lucide-react";

const STEPS = [
  { number: 1, label: "Details" },
  { number: 2, label: "Delivery" },
  { number: 3, label: "Payment" },
] as const;

export default function CheckoutStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-start gap-2 px-4">
      <div className="flex flex-1 items-start">
        {STEPS.map((step, index) => {
          const done = step.number < current;
          const active = step.number === current;
          const caption = done ? "Completed" : active ? `Step ${step.number} of 3` : "Pending";

          return (
            <div key={step.number} className="flex flex-1 items-start last:flex-none">
              <div className="flex w-16 shrink-0 flex-col items-center gap-1 text-center">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    done
                      ? "bg-brand text-white"
                      : active
                        ? "bg-brand text-white ring-4 ring-brand/15"
                        : "bg-line text-ink-slate"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : step.number}
                </span>
                <span
                  className={`text-[11px] font-semibold leading-none ${
                    done || active ? "text-brand-darkest" : "text-ink-slate"
                  }`}
                >
                  {step.label}
                </span>
                {current !== 1 && (
                  <span className="text-[9px] leading-none text-ink-slate">{caption}</span>
                )}
              </div>

              {index < STEPS.length - 1 && (
                <span
                  className={`mt-3.5 h-0.5 flex-1 rounded-full ${
                    step.number < current ? "bg-brand" : "bg-line"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {current === 1 && (
        <span className="mt-0.5 shrink-0 rounded-full border border-line bg-white px-2.5 py-1 text-[10px] font-semibold text-ink-slate">
          1 of 3
        </span>
      )}
    </div>
  );
}
