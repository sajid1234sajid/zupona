import type { ReactNode } from "react";

/** A small label on a product, drawn from data the shop holds -- never typed
 * in to hurry anyone (Doc 01 §3.4). Each kind has one look everywhere. */
export type BadgeKind =
  | "bestSeller"
  | "lowStock"
  | "seasonal"
  | "rank"
  | "freeDelivery"
  | "verified"
  | "sold"
  | "label";

const STYLES: Record<BadgeKind, string> = {
  bestSeller: "bg-urgency text-white",
  lowStock: "bg-urgency/10 text-urgency",
  seasonal: "bg-discount text-white",
  rank: "bg-badge-bg text-heading",
  freeDelivery: "bg-brand-tint text-brand-dark",
  verified: "bg-brand-tint text-brand-dark",
  sold: "bg-black/65 text-white",
  label: "bg-urgency text-white",
};

export default function Badge({
  kind,
  children,
  size = "sm",
  className = "",
}: {
  kind: BadgeKind;
  children: ReactNode;
  size?: "xs" | "sm";
  className?: string;
}) {
  const scale =
    size === "xs"
      ? "rounded-[3px] px-1 text-[9px] leading-[1.45]"
      : "min-h-[26px] rounded-full px-2.5 text-[11.5px]";
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap font-bold ${scale} ${STYLES[kind]} ${className}`}>
      {children}
    </span>
  );
}
