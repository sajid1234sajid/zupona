"use client";

import { useCallback, useState, type ReactNode } from "react";

/** Mounts its children only once they come within a screen of view.
 *
 * For the feeds at the bottom of a page: every product card hydrates as a
 * client component, and doing that for a grid nobody has scrolled to yet is
 * main-thread time taken from the buttons the shopper is about to press. The
 * placeholder holds the space so nothing jumps when it arrives. */
export default function MountWhenNear({
  children,
  minHeight = 600,
}: {
  children: ReactNode;
  minHeight?: number;
}) {
  const [near, setNear] = useState(false);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (near) return <>{children}</>;
  return <div ref={ref} style={{ minHeight }} aria-hidden />;
}
