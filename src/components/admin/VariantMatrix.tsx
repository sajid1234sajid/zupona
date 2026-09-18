"use client";

import { Eye, EyeOff } from "lucide-react";
import {
  splitStock,
  type CellOverride,
  type MatrixCell,
} from "./optionBuilder";
import { Th, Td, Thumb, buttonStyles } from "./ui";

/** Every combination the options imply, one row each.
 *
 * Stock lives here and nowhere else, which is why a blank box is not the same
 * as a zero: a row the admin has not touched posts nothing and the stored
 * figure is left alone. A product that does not count its units has no stock
 * columns at all -- the rest of the row still does its job, because a
 * combination is about price, picture and whether it sells, not only stock. A row that is switched off keeps its stock, SKU and
 * price -- it stops being sellable, it is not written down to nothing -- and
 * switching it back on brings all of it back. */

const SMALL_INPUT =
  "h-9 w-full min-w-0 rounded-lg border border-neutral-200 px-2 text-sm outline-none transition focus:border-brand";

interface VariantMatrixProps {
  matrix: MatrixCell[];
  cells: Record<string, CellOverride>;
  onChange: (cells: Record<string, CellOverride>) => void;
  /** The product's gallery, so a combination can pick one of its images. */
  gallery: string[];
  /** On the create form, the total entered above is spread across the rows the
   * way it always was; an untouched row shows its share. */
  defaultStock?: number;
  /** False when the product does not count its units, which takes the two
   * stock columns out of the table altogether -- there is nothing for them to
   * hold and an empty box invites a figure that would never be read. */
  showStock: boolean;
  maxVariants: number;
}

export default function VariantMatrix({
  matrix,
  cells,
  onChange,
  gallery,
  defaultStock,
  showStock,
  maxVariants,
}: VariantMatrixProps) {
  const patch = (key: string, change: Partial<CellOverride>) =>
    onChange({ ...cells, [key]: { ...cells[key], ...change } });

  const stockValue = (cell: MatrixCell, index: number): string => {
    const typed = cells[cell.key]?.stock;
    if (typed !== undefined) return typed;
    if (defaultStock !== undefined) return String(splitStock(defaultStock, matrix.length, index));
    return "";
  };

  const label = (cell: MatrixCell) =>
    cell.parts.map((part) => part.value).join(" · ") || "Default";

  const swatch = (cell: MatrixCell) => cell.parts.find((part) => part.colorHex)?.colorHex ?? "";

  if (matrix.length > maxVariants) {
    return (
      <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
        Those options make {matrix.length} combinations, and the limit is {maxVariants}. Remove
        some values before saving.
      </p>
    );
  }

  const rows = matrix.map((cell, index) => {
    const override = cells[cell.key] ?? {};
    const active = override.isActive !== false;
    return { cell, index, override, active };
  });

  return (
    <div className="min-w-0">
      {/* Desktop: one row per combination. */}
      <div className="hidden overflow-x-auto tab:block">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr className="border-b border-neutral-100">
              {/* Widths are set here rather than left to the browser: the image
                  cell holds a thumbnail and a select, and auto layout gave it
                  the narrowest column of the eight. */}
              <Th>Combination</Th>
              <Th className="w-36">SKU</Th>
              <Th className="w-28 text-right">Price</Th>
              <Th className="w-28 text-right">Compare at</Th>
              {showStock ? (
                <>
                  <Th className="w-24 text-right">Stock</Th>
                  <Th className="w-24 text-right">Low at</Th>
                </>
              ) : null}
              <Th className="w-48">Image</Th>
              <Th className="w-16 text-right">Active</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cell, index, override, active }) => (
              <tr
                key={cell.key}
                className={`border-b border-neutral-50 last:border-0 ${active ? "" : "bg-neutral-50/70"}`}
              >
                <Td>
                  <span className="flex items-center gap-2">
                    {swatch(cell) ? (
                      <span
                        aria-hidden
                        className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                        style={{ background: swatch(cell) }}
                      />
                    ) : null}
                    <span className="font-medium text-neutral-800">{label(cell)}</span>
                  </span>
                </Td>
                <Td>
                  <input
                    value={override.sku ?? ""}
                    maxLength={60}
                    onChange={(event) => patch(cell.key, { sku: event.target.value })}
                    placeholder="Optional"
                    aria-label={`SKU for ${label(cell)}`}
                    className={SMALL_INPUT}
                  />
                </Td>
                <Td>
                  <input
                    type="number"
                    min={0}
                    value={override.price ?? ""}
                    onChange={(event) => patch(cell.key, { price: event.target.value })}
                    placeholder="Inherit"
                    aria-label={`Price for ${label(cell)}`}
                    className={`${SMALL_INPUT} text-right`}
                  />
                </Td>
                <Td>
                  <input
                    type="number"
                    min={0}
                    value={override.oldPrice ?? ""}
                    onChange={(event) => patch(cell.key, { oldPrice: event.target.value })}
                    placeholder="—"
                    aria-label={`Compare-at price for ${label(cell)}`}
                    className={`${SMALL_INPUT} text-right`}
                  />
                </Td>
                {showStock ? (
                  <>
                    <Td>
                      <input
                        type="number"
                        min={0}
                        value={stockValue(cell, index)}
                        onChange={(event) => patch(cell.key, { stock: event.target.value })}
                        aria-label={`Stock for ${label(cell)}`}
                        className={`${SMALL_INPUT} text-right`}
                      />
                    </Td>
                    <Td>
                      <input
                        type="number"
                        min={0}
                        value={override.lowStockThreshold ?? ""}
                        onChange={(event) =>
                          patch(cell.key, { lowStockThreshold: event.target.value })
                        }
                        placeholder="5"
                        aria-label={`Low stock alert for ${label(cell)}`}
                        className={`${SMALL_INPUT} text-right`}
                      />
                    </Td>
                  </>
                ) : null}
                <Td>
                  <span className="flex items-center gap-2">
                    <Thumb src={override.imageUrl || null} alt="" size={28} />
                    <select
                      value={override.imageUrl ?? ""}
                      onChange={(event) => patch(cell.key, { imageUrl: event.target.value })}
                      aria-label={`Image for ${label(cell)}`}
                      className={SMALL_INPUT}
                    >
                      <option value="">No image</option>
                      {gallery.map((url, imageIndex) => (
                        <option key={url} value={url}>
                          Image {imageIndex + 1}
                        </option>
                      ))}
                    </select>
                  </span>
                </Td>
                <Td className="text-right">
                  <button
                    type="button"
                    onClick={() => patch(cell.key, { isActive: !active })}
                    aria-pressed={active}
                    aria-label={`${active ? "Retire" : "Restore"} combination ${label(cell)}`}
                    title={
                      active
                        ? "Stop selling this combination. Its stock and SKU are kept."
                        : "Sell this combination again"
                    }
                    className={`${buttonStyles.ghost} h-9 w-9 p-0 ${active ? "text-brand" : ""}`}
                  >
                    {active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Under 700px a row is too wide to read, so each combination is a card. */}
      <div className="space-y-2.5 tab:hidden">
        {rows.map(({ cell, index, override, active }) => (
          <div
            key={cell.key}
            className={`rounded-xl border p-3 ${
              active ? "border-neutral-200 bg-white" : "border-dashed border-neutral-200 bg-neutral-50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                {swatch(cell) ? (
                  <span
                    aria-hidden
                    className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                    style={{ background: swatch(cell) }}
                  />
                ) : null}
                <span className="truncate text-[13px] font-semibold text-neutral-800">
                  {label(cell)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => patch(cell.key, { isActive: !active })}
                aria-pressed={active}
                aria-label={`${active ? "Retire" : "Restore"} combination ${label(cell)}`}
                className={`${buttonStyles.ghost} h-8 w-8 shrink-0 p-0 ${active ? "text-brand" : ""}`}
              >
                {active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <label className="col-span-2 block">
                <span className="mb-1 block text-[11px] text-neutral-500">SKU</span>
                <input
                  value={override.sku ?? ""}
                  maxLength={60}
                  onChange={(event) => patch(cell.key, { sku: event.target.value })}
                  placeholder="Optional"
                  className={SMALL_INPUT}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-neutral-500">Price</span>
                <input
                  type="number"
                  min={0}
                  value={override.price ?? ""}
                  onChange={(event) => patch(cell.key, { price: event.target.value })}
                  placeholder="Inherit"
                  className={SMALL_INPUT}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-neutral-500">Compare at</span>
                <input
                  type="number"
                  min={0}
                  value={override.oldPrice ?? ""}
                  onChange={(event) => patch(cell.key, { oldPrice: event.target.value })}
                  placeholder="—"
                  className={SMALL_INPUT}
                />
              </label>
              {showStock ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-neutral-500">Stock</span>
                    <input
                      type="number"
                      min={0}
                      value={stockValue(cell, index)}
                      onChange={(event) => patch(cell.key, { stock: event.target.value })}
                      className={SMALL_INPUT}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-neutral-500">Low at</span>
                    <input
                      type="number"
                      min={0}
                      value={override.lowStockThreshold ?? ""}
                      onChange={(event) =>
                        patch(cell.key, { lowStockThreshold: event.target.value })
                      }
                      placeholder="5"
                      className={SMALL_INPUT}
                    />
                  </label>
                </>
              ) : null}
              <label className="col-span-2 block">
                <span className="mb-1 block text-[11px] text-neutral-500">Image</span>
                <select
                  value={override.imageUrl ?? ""}
                  onChange={(event) => patch(cell.key, { imageUrl: event.target.value })}
                  className={SMALL_INPUT}
                >
                  <option value="">No image</option>
                  {gallery.map((url, imageIndex) => (
                    <option key={url} value={url}>
                      Image {imageIndex + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-neutral-400">
        {matrix.length} combination{matrix.length === 1 ? "" : "s"}. An empty price inherits the
        product price, and the product&apos;s discount applies to a price set here too.{" "}
        {showStock
          ? "Stock changes are written to the inventory ledger; retiring a combination does not move any stock."
          : "This product is not counting stock, so every combination sells without a limit."}
      </p>
    </div>
  );
}
