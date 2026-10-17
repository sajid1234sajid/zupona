"use client";

import { useEffect, useRef, useState } from "react";
import { Ruler, X } from "lucide-react";
import { toCm, type SizeGuide as SizeGuideTable } from "@/lib/sizeGuide";

/** "Size guide" beside the size choices, and the sheet it opens: the shop's
 * size table in inches or cm, how to measure, and how the product fitted the
 * people who reviewed it. */
export default function SizeGuide({
  guide,
  fit,
}: {
  guide: SizeGuideTable;
  /** Counts from reviews; the line shows once enough people have said. */
  fit: { small: number; true: number; large: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<"in" | "cm">("in");
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  const answered = fit ? fit.small + fit.true + fit.large : 0;
  const trueShare = fit && answered >= 3 ? Math.round((fit.true / answered) * 100) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[32px] items-center gap-1 text-xs font-bold text-brand underline-offset-2 hover:underline"
      >
        <Ruler className="h-3.5 w-3.5" aria-hidden />
        Size guide
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        aria-labelledby="size-guide-title"
        className="m-auto w-[min(92vw,520px)] rounded-2xl bg-white p-0 text-heading backdrop:bg-black/50"
      >
        <div className="p-4 tab:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="size-guide-title" className="text-base font-extrabold">
              Size guide
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full bg-brand-mist"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {trueShare !== null ? (
            <p className="mt-2 rounded-lg bg-brand-tint px-3 py-2 text-[12.5px] font-semibold text-brand-dark">
              {trueShare}% of reviewers say it fits true to size.
            </p>
          ) : null}

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-ink-slate">Body measurements</p>
            <div className="flex rounded-full bg-brand-mist p-0.5" role="group" aria-label="Unit">
              {(["in", "cm"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={unit === option}
                  onClick={() => setUnit(option)}
                  className={`h-8 rounded-full px-3 text-xs font-bold ${
                    unit === option ? "bg-white text-heading shadow-card" : "text-ink-muted"
                  }`}
                >
                  {option === "in" ? "Inch" : "CM"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[280px] text-left text-[13px]">
              <thead className="bg-brand-mist text-xs text-ink-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-bold">
                    Size
                  </th>
                  {guide.columns.map((column) => (
                    <th key={column} scope="col" className="px-3 py-2 font-bold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guide.rows.map((row) => (
                  <tr key={row.size} className="border-t border-line-soft">
                    <th scope="row" className="px-3 py-2 font-extrabold">
                      {row.size}
                    </th>
                    {row.values.map((value, index) => (
                      <td key={index} className="px-3 py-2 tabular-nums">
                        {value === null ? "–" : unit === "in" ? value : toCm(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-4 text-sm font-bold">How to measure</h3>
          <ul className="mt-1.5 space-y-1 text-[12.5px] text-ink-slate">
            <li>
              <strong className="text-heading">Chest:</strong> round the fullest part of your chest, under the arms.
            </li>
            <li>
              <strong className="text-heading">Length:</strong> from the highest point of the shoulder down to the hem.
            </li>
            <li>
              <strong className="text-heading">Sleeve:</strong> from the shoulder seam to the wrist.
            </li>
            <li>Between two sizes? Pick the larger one for a relaxed fit.</li>
          </ul>
        </div>
      </dialog>
    </>
  );
}
