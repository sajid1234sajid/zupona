import { formatCompactPrice, formatPrice } from "@/lib/format";

/** Chart colors.
 *
 * Order status is *state*, not identity, so these are status tokens rather
 * than a categorical series palette, and each one always ships with its label
 * and value beside it -- never color alone. Amber and green sit in the 6-8
 * colorblind separation band, which is only legal alongside that secondary
 * encoding, so the donut keeps a surface gap between segments and the legend
 * repeats every figure as text. */
export const STATUS_COLORS: Record<string, string> = {
  delivered: "#16a34a",
  confirmed: "#0ea5e9",
  processing: "#0ea5e9",
  placed: "#f59e0b",
  pending: "#f59e0b",
  shipped: "#8b5cf6",
  out_for_delivery: "#6366f1",
  cancelled: "#ef4444",
  returned: "#94a3b8",
};

export const BRAND_SERIES = "#16a34a";

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "#94a3b8";
}

/* -------------------------------------------------------------------------- */
/* Donut                                                                      */
/* -------------------------------------------------------------------------- */

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Part-to-whole at a glance, capped at six segments because past that
 * adjacent arcs blur together. Segments are separated by a surface-colored gap
 * rather than a stroke outline, and the legend carries every number as text so
 * the chart never depends on color alone. */
export function DonutChart({
  slices,
  total,
  totalLabel,
  size = 168,
}: {
  slices: DonutSlice[];
  total: number;
  totalLabel: string;
  size?: number;
}) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const drawable = slices.filter((slice) => slice.value > 0);
  const sum = drawable.reduce((acc, slice) => acc + slice.value, 0);

  // A 2px visual gap between segments, expressed in path length.
  const gap = drawable.length > 1 ? 3 : 0;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#f1f5f3" strokeWidth="18" />
          {sum > 0
            ? drawable.map((slice) => {
                const length = (slice.value / sum) * circumference;
                const dash = Math.max(0, length - gap);
                const element = (
                  <circle
                    key={slice.label}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="18"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                  >
                    <title>{`${slice.label}: ${slice.value}`}</title>
                  </circle>
                );
                offset += length;
                return element;
              })
            : null}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-neutral-900">
            {total.toLocaleString("en-US")}
          </span>
          <span className="text-[11px] text-neutral-400">{totalLabel}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-2 sm:w-auto sm:min-w-[9rem]">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: slice.color }}
            />
            <span className="min-w-0 flex-1 truncate text-neutral-600">{slice.label}</span>
            <span className="shrink-0 font-semibold text-neutral-800">
              {sum === 0 ? "0%" : `${Math.round((slice.value / sum) * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bar list                                                                   */
/* -------------------------------------------------------------------------- */

export interface BarRow {
  label: string;
  value: number;
  /** Secondary figure shown to the right, e.g. unit count. */
  meta?: string;
  href?: string;
}

/** Ranked magnitudes. A bar list beats a pie for this: lengths on a shared
 * baseline are the one comparison people read accurately. One series, so one
 * color for every bar -- shading them by size would double-encode the length
 * that is already the point. */
export function BarList({
  rows,
  format = (value: number) => value.toLocaleString("en-US"),
}: {
  rows: BarRow[];
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] font-medium text-neutral-700">
              {row.label}
            </span>
            <span className="shrink-0 text-[13px] font-semibold text-neutral-800">
              {format(row.value)}
              {row.meta ? (
                <span className="ml-1.5 text-[11px] font-normal text-neutral-400">{row.meta}</span>
              ) : null}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Rating histogram                                                           */
/* -------------------------------------------------------------------------- */

/** The 5-to-1 star breakdown on the reviews page. */
export function RatingBars({
  counts,
  total,
}: {
  counts: Record<1 | 2 | 3 | 4 | 5, number>;
  total: number;
}) {
  return (
    <ul className="space-y-2">
      {([5, 4, 3, 2, 1] as const).map((star) => {
        const count = counts[star];
        const percent = total === 0 ? 0 : Math.round((count / total) * 100);
        return (
          <li key={star} className="flex items-center gap-2.5 text-xs">
            <span className="w-6 shrink-0 text-neutral-500">{star}★</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <span
                className="block h-full rounded-full bg-accent-orange"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right font-semibold text-neutral-700">{count}</span>
            <span className="w-9 shrink-0 text-right text-neutral-400">{percent}%</span>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Sparkline                                                                  */
/* -------------------------------------------------------------------------- */

/** A trend shape with no axes, for use inside a small card where the headline
 * number carries the value and the line only carries direction. */
export function Sparkline({
  values,
  className = "",
}: {
  values: number[];
  className?: string;
}) {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = 100 / (values.length - 1);

  const points = values
    .map((value, index) => `${(index * step).toFixed(2)},${(28 - ((value - min) / span) * 26).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden
      className={`h-8 w-full ${className}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={BRAND_SERIES}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Table fallback                                                             */
/* -------------------------------------------------------------------------- */

/** The sales chart's values as text.
 *
 * Two jobs: it is the accessible alternative to the plotted line, and it is
 * what a reader falls back on when the chart's own colors are hard to
 * separate. Collapsed by default so it doesn't compete with the chart. */
export function SeriesTable({
  points,
}: {
  points: { day: string; orders: number; revenue: number }[];
}) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-[11px] font-medium text-neutral-400 transition hover:text-brand">
        View as table
      </summary>
      <div className="mt-2 max-h-52 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-white">
            <tr className="text-neutral-400">
              <th className="py-1.5 font-medium">Day</th>
              <th className="py-1.5 text-right font-medium">Orders</th>
              <th className="py-1.5 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.day} className="border-t border-neutral-50">
                <td className="py-1.5 text-neutral-600">{point.day}</td>
                <td className="py-1.5 text-right text-neutral-700">{point.orders}</td>
                <td className="py-1.5 text-right font-medium text-neutral-800">
                  {formatPrice(point.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export { formatCompactPrice };
