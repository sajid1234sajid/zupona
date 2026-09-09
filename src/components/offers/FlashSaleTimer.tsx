"use client";

import { useEffect, useState } from "react";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Live countdown to the end of the flash-sale window.
 *
 * The clock is deliberately not rendered on the server: server and client
 * would read `Date.now()` a few hundred milliseconds apart and React would
 * flag the difference as a hydration mismatch. Rendering a fixed placeholder
 * first and filling it in after mount is the only version of this that is
 * both live and stable.
 */
export default function FlashSaleTimer({
  endsAt,
  onExpired,
}: {
  /** ISO timestamp; parsed on the client. */
  endsAt: string;
  onExpired?: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(endsAt).getTime();

    function tick() {
      const left = Math.max(0, target - Date.now());
      setRemaining(left);
      if (left === 0) onExpired?.();
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt, onExpired]);

  const parts =
    remaining === null
      ? ["--", "--", "--"]
      : [
          pad(Math.floor(remaining / 3_600_000)),
          pad(Math.floor((remaining % 3_600_000) / 60_000)),
          pad(Math.floor((remaining % 60_000) / 1000)),
        ];

  return (
    <span
      className="flex items-center gap-0.5"
      role="timer"
      aria-label="Time left in this flash sale"
    >
      {parts.map((part, index) => (
        <span key={index} className="flex items-center gap-0.5">
          {index > 0 && <span className="text-[10px] font-bold text-neutral-900">:</span>}
          <span className="min-w-[19px] rounded bg-neutral-900 px-1 py-0.5 text-center text-[10px] font-bold tabular-nums text-white">
            {part}
          </span>
        </span>
      ))}
    </span>
  );
}
