"use client";

import { useEffect, useRef, useState } from "react";

/** How tall the description is before "See More". */
const COLLAPSED_PX = 180;

/** The product's description and spec sheet, folded to a few lines.
 *
 * "See More" appears only when the text is actually taller than the fold --
 * measured, not guessed from a character count, so a short description never
 * gets a button that reveals nothing. A product with neither a description
 * nor attributes renders no card at all. */
export default function ProductDescription({
  description,
  attributes,
}: {
  description: string | null;
  attributes: { name: string; value: string }[];
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const text = description?.trim() ?? "";
  const isEmpty = text === "" && attributes.length === 0;

  useEffect(() => {
    const element = bodyRef.current;
    if (!element) return;

    const measure = () => setOverflows(element.scrollHeight > COLLAPSED_PX + 8);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, attributes]);

  if (isEmpty) return null;

  // The height cap is on from the first paint, so a long description never
  // renders in full and then snaps shut once it has been measured. On a short
  // one the cap is taller than the text and changes nothing.
  const capped = !expanded;
  const folded = overflows && !expanded;

  return (
    <section id="description" aria-labelledby="description-title" className="rounded-2xl border border-line bg-white p-4">
      <h2 id="description-title" className="text-base font-extrabold text-heading">
        Description
      </h2>

      <div className="relative mt-2.5">
        <div
          ref={bodyRef}
          className="overflow-hidden text-sm leading-relaxed text-ink"
          style={capped ? { maxHeight: COLLAPSED_PX } : undefined}
        >
          {attributes.length > 0 && (
            <ul className="mb-2 list-disc space-y-1 pl-5 marker:text-brand">
              {attributes.map((attribute, index) => (
                <li key={`${attribute.name}-${index}`}>
                  <span className="font-semibold text-heading">{attribute.name}:</span> {attribute.value}
                </li>
              ))}
            </ul>
          )}
          {text && <p className="whitespace-pre-line break-words">{text}</p>}
        </div>

        {folded && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-white/0"
          />
        )}
      </div>

      {overflows && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="min-h-[40px] rounded-full bg-brand px-5 text-[13px] font-bold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {expanded ? "See Less" : "See More"}
          </button>
        </div>
      )}
    </section>
  );
}
