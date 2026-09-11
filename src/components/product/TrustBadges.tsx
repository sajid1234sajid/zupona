import { BadgeCheck, Truck, RotateCcw } from "lucide-react";

const badges = [
  { icon: BadgeCheck, label: "100% Original" },
  { icon: Truck, label: "Fast Delivery" },
  { icon: RotateCcw, label: "7 Days Return" },
];

/** The reassurance band under the price: one mint bar, three cells divided by
 * thin rules, icon inline with its label. Measured off the reference at 36 CSS
 * px tall -- stacking the icon above the label made it nearly twice that. */
export default function TrustBadges() {
  return (
    <div className="px-4 pt-3">
      <div className="grid grid-cols-3 overflow-hidden rounded-xl bg-brand-tint">
        {badges.map(({ icon: Icon, label }, index) => (
          <div
            key={label}
            className={`flex min-w-0 items-center justify-center gap-1.5 px-1 py-2.5 ${
              index > 0 ? "border-l border-white/70" : ""
            }`}
          >
            <Icon className="h-[15px] w-[15px] shrink-0 text-brand-dark" strokeWidth={2.25} />
            <span className="truncate text-[10.5px] font-semibold text-brand-darkest">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
