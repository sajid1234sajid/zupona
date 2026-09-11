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
              <div className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
                    done
                      ? "bg-brand text-white"
                      : active
                        ? "bg-brand text-white ring-4 ring-brand/15"
                        : "bg-line text-ink-slate"
                  }`}
                >
                  {done ? <Check className="h-[18px] w-[18px]" strokeWidth={3} /> : step.number}
                </span>
                <span
                  className={`text-[12.5px] font-bold leading-none ${
                    done || active ? "text-brand-darkest" : "text-ink-slate"
                  }`}
                >
                  {step.label}
                </span>
                {current !== 1 && (
                  <span className="text-[10.5px] leading-none text-ink-slate">{caption}</span>
                )}
              </div>

              {index < STEPS.length - 1 && (
                <span
                  className={`mt-[17px] h-[3px] flex-1 rounded-full ${
                    step.number < current ? "bg-brand" : "bg-line"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {current === 1 && (
        <span className="mt-1 shrink-0 rounded-full bg-brand-tint px-3 py-1 text-[11px] font-bold text-brand-dark">
          1 of 3
        </span>
      )}
    </div>
  );
}
