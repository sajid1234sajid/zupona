import { Star } from "lucide-react";

/** Stars for an average, in half steps, with the review count.
 *
 * Nothing at all when there are no reviews -- "0.0 (0)" reads as a product
 * nobody likes -- unless `empty` says what to show instead, as the product
 * page does with "No reviews yet". */
export default function RatingStars({
  value,
  count,
  size = "sm",
  showValue = false,
  empty,
  className = "",
}: {
  value: number;
  count: number;
  size?: "xs" | "sm" | "md";
  showValue?: boolean;
  empty?: string;
  className?: string;
}) {
  if (count <= 0) {
    return empty ? <span className={`text-[12px] text-ink-muted ${className}`}>{empty}</span> : null;
  }
  const star = { xs: "h-2.5 w-2.5", sm: "h-3.5 w-3.5", md: "h-4 w-4" }[size];
  const text = { xs: "text-[10px]", sm: "text-[12px]", md: "text-[13px]" }[size];
  const rounded = Math.round(value * 2) / 2;
  return (
    <span
      className={`inline-flex items-center gap-[1px] leading-none text-ink-slate ${text} ${className}`}
      aria-label={`Rated ${value.toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`}
    >
      {showValue ? <span className="mr-1 font-bold text-heading">{value.toFixed(1)}</span> : null}
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = rounded >= n ? 1 : rounded >= n - 0.5 ? 0.5 : 0;
        return (
          <span key={n} className={`relative inline-block shrink-0 ${star}`} aria-hidden>
            <Star className={`absolute inset-0 ${star} fill-line text-line`} />
            {fill > 0 ? (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: fill === 1 ? "100%" : "50%" }}>
                <Star className={`${star} fill-rating text-rating`} />
              </span>
            ) : null}
          </span>
        );
      })}
      <span className="ml-1">({count.toLocaleString("en-US")})</span>
    </span>
  );
}
