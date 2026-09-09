"use client";

import { useMemo, useState } from "react";
import { formatCompactPrice, formatPrice, parseDbDate } from "@/lib/format";

export interface SalesPoint {
  day: string;
  orders: number;
  revenue: number;
}

const VIEW_W = 720;
const VIEW_H = 240;
const PAD = { top: 16, right: 16, bottom: 30, left: 56 };

const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

/** Rounds an axis maximum up to a readable step, so the top gridline reads
 * "৳15K" rather than "৳14,382". */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / (magnitude / 2)) * (magnitude / 2);
}

function shortDay(day: string): string {
  const date = parseDbDate(day);
  if (!date) return day;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Revenue over time.
 *
 * One series, so there is no legend to draw -- the card's title names it. The
 * only direct label is on the highest point, because a number beside every
 * point is noise; the hover crosshair carries the rest. */
export default function SalesChart({ points }: { points: SalesPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const max = niceMax(Math.max(...points.map((point) => point.revenue), 0));
    const step = points.length > 1 ? PLOT_W / (points.length - 1) : 0;

    const coords = points.map((point, index) => ({
      x: PAD.left + index * step,
      y: PAD.top + PLOT_H - (max === 0 ? 0 : (point.revenue / max) * PLOT_H),
      point,
    }));

    let peak = 0;
    for (let i = 1; i < coords.length; i += 1) {
      if (coords[i].point.revenue > coords[peak].point.revenue) peak = i;
    }

    return { max, coords, peak };
  }, [points]);

  if (points.length === 0) {
    return (
      <p className="py-14 text-center text-sm text-neutral-400">
        No sales in this period yet.
      </p>
    );
  }

  const { max, coords, peak } = geometry;
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${PAD.left},${PAD.top + PLOT_H} ${line} ${(PAD.left + PLOT_W).toFixed(1)},${
    PAD.top + PLOT_H
  }`;

  const gridValues = [0, 0.25, 0.5, 0.75, 1];
  // Roughly six x labels regardless of window length, so a 90-day range does
  // not stack its dates on top of each other.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  const active = hover === null ? null : coords[hover];

  return (
    <div
      className="relative"
      onPointerLeave={() => setHover(null)}
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientX - box.left) / box.width;
        const x = ratio * VIEW_W;
        const index = Math.round(((x - PAD.left) / PLOT_W) * (points.length - 1));
        setHover(Math.max(0, Math.min(points.length - 1, index)));
      }}
    >
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-auto w-full" role="img"
        aria-label={`Revenue for the last ${points.length} days`}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((fraction) => {
          const y = PAD.top + PLOT_H - fraction * PLOT_H;
          return (
            <g key={fraction}>
              <line
                x1={PAD.left}
                x2={PAD.left + PLOT_W}
                y1={y}
                y2={y}
                stroke="#eef2f0"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-neutral-400"
                fontSize="11"
              >
                {formatCompactPrice(max * fraction)}
              </text>
            </g>
          );
        })}

        <polygon points={area} fill="url(#salesFill)" />
        <polyline
          points={line}
          fill="none"
          stroke="#16a34a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {coords.map((coord, index) =>
          index % labelEvery === 0 || index === coords.length - 1 ? (
            <text
              key={coord.point.day}
              x={coord.x}
              y={VIEW_H - 8}
              textAnchor={index === 0 ? "start" : index === coords.length - 1 ? "end" : "middle"}
              className="fill-neutral-400"
              fontSize="11"
            >
              {shortDay(coord.point.day)}
            </text>
          ) : null
        )}

        {/* The peak is the one point worth labelling without a hover. */}
        {coords[peak].point.revenue > 0 && hover === null ? (
          <g>
            <circle
              cx={coords[peak].x}
              cy={coords[peak].y}
              r="4.5"
              fill="#16a34a"
              stroke="#ffffff"
              strokeWidth="2"
            />
            <text
              x={Math.min(coords[peak].x, PAD.left + PLOT_W - 34)}
              y={Math.max(coords[peak].y - 12, PAD.top + 10)}
              textAnchor="middle"
              className="fill-neutral-500"
              fontSize="11"
              fontWeight="600"
            >
              {formatCompactPrice(coords[peak].point.revenue)}
            </text>
          </g>
        ) : null}

        {active ? (
          <g>
            <line
              x1={active.x}
              x2={active.x}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke="#16a34a"
              strokeWidth="1"
              strokeOpacity="0.35"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={active.x}
              cy={active.y}
              r="5"
              fill="#16a34a"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        ) : null}
      </svg>

      {active ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-neutral-900 px-3 py-2 text-[11px] text-white shadow-lg"
          style={{
            left: `${Math.min(88, Math.max(12, (active.x / VIEW_W) * 100))}%`,
            top: `${(active.y / VIEW_H) * 100 - 3}%`,
          }}
        >
          <p className="font-semibold">{shortDay(active.point.day)}</p>
          <p className="text-white/70">{formatPrice(active.point.revenue)}</p>
          <p className="text-white/50">
            {active.point.orders} order{active.point.orders === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
