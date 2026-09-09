import { BadgeCheck, Truck, RotateCcw } from "lucide-react";

const badges = [
  { icon: BadgeCheck, label: "100% Original" },
  { icon: Truck, label: "Fast Delivery" },
  { icon: RotateCcw, label: "7 Days Return" },
];

export default function TrustBadges() {
  return (
    <div className="grid grid-cols-3 gap-2 px-4 pt-3">
      {badges.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-1 rounded-lg bg-brand-tint py-2 text-center"
        >
          <Icon className="h-4 w-4 text-brand" />
          <span className="text-[10px] font-medium text-neutral-600">{label}</span>
        </div>
      ))}
    </div>
  );
}
