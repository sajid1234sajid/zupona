"use client";

import { useEffect, useState } from "react";

/** Time left until `endsAt`, as "03:12:45" or "2d 03:12:45".
 *
 * Only ever drawn for a real deadline -- a sale's end read from the database
 * -- and it removes itself at zero rather than sitting on 00:00:00 or
 * counting into negative numbers. Rendered empty on the server and filled in
 * after hydration, so the server's clock and the shopper's never disagree on
 * screen. */
export default function Countdown({
  endsAt,
  className = "",
  label = "Ends in",
}: {
  /** ISO timestamp. */
  endsAt: string;
  className?: string;
  label?: string;
}) {
  const end = Date.parse(endsAt);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  if (!Number.isFinite(end) || now === null || end - now <= 0) return null;

  const total = Math.floor((end - now) / 1000);
  const days = Math.floor(total / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;

  return (
    <span
      role="timer"
      aria-label={`${label} ${days ? `${days} days ` : ""}${clock}`}
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold text-urgency tab:text-[13px] ${className}`}
    >
      {label}
      <span className="rounded-md bg-urgency px-1.5 py-0.5 font-mono font-bold tabular-nums text-white">
        {days ? `${days}d ` : ""}
        {clock}
      </span>
    </span>
  );
}
