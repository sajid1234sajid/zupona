/** Stars for an average, filled to the exact rating, with the review count.
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
  const glyph = { xs: "text-[11px]", sm: "text-[14px]", md: "text-[17px]" }[size];
  const text = { xs: "text-[10px]", sm: "text-[12px]", md: "text-[13px]" }[size];
  // Two rows of text stars, the coloured one cut to the rating's width. A
  // grid draws dozens of these, and ten SVG icons a card measured about 60ms
  // more main-thread work on a throttled phone than two runs of text.
  const filled = `${Math.max(0, Math.min(5, value)) * 20}%`;
  return (
    <span
      className={`inline-flex items-center leading-none text-ink-slate ${text} ${className}`}
      aria-label={`Rated ${value.toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`}
    >
      {showValue ? <span className="mr-1 font-bold text-heading">{value.toFixed(1)}</span> : null}
      <span aria-hidden className={`relative inline-block tracking-[1px] text-line ${glyph}`}>
        ★★★★★
        <span className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-rating" style={{ width: filled }}>
          ★★★★★
        </span>
      </span>
      <span className="ml-1">({count.toLocaleString("en-US")})</span>
    </span>
  );
}
