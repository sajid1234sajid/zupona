"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Header height plus a gap: where a stuck column's top rests. */
const TOP = 80;

/** A column that stays on screen beside a longer one, on wide screens.
 *
 * Plain `position: sticky` pins the top, which hides the bottom of a column
 * taller than the window -- here the delivery details and the guarantees,
 * under the buy buttons. So the offset is the header gap when the column
 * fits, and otherwise negative by however much it overflows: it then scrolls
 * with the page until its bottom reaches the bottom of the window, and stays
 * there. Below the wide breakpoint it is an ordinary block. */
export default function StickyColumn({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(TOP);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setTop(Math.min(TOP, window.innerHeight - node.offsetHeight - 16));
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div ref={ref} className="tab:sticky" style={{ top }}>
      {children}
    </div>
  );
}
