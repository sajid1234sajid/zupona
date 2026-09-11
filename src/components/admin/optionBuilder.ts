import type { OptionDisplay } from "@/lib/optionModel";
import type { EditableOptionGroup, EditableVariant } from "@/lib/adminData";

/** The editing state behind the option builder and the variant matrix.
 *
 * Both screens work in `ref`s rather than database ids. A saved group or value
 * uses its own id as its ref, so a combination keeps the same identity across
 * a reload; a newly added one gets a generated ref that the server swaps for a
 * real id when it saves. That is what lets the matrix name a combination that
 * does not exist yet. */

export interface BuilderValue {
  ref: string;
  id: string | null;
  label: string;
  colorHex: string;
  imageUrl: string;
  isActive: boolean;
  /** Saved values are retired rather than removed -- variants and orders point
   * at them -- so only an unsaved one gets a delete button. */
  persisted: boolean;
}

export interface BuilderGroup {
  ref: string;
  id: string | null;
  name: string;
  display: OptionDisplay;
  showLabels: boolean;
  isActive: boolean;
  values: BuilderValue[];
  persisted: boolean;
}

/** What the admin typed into one row of the matrix. Strings, because an empty
 * box has to stay distinguishable from a zero. */
export interface CellOverride {
  sku?: string;
  price?: string;
  oldPrice?: string;
  stock?: string;
  lowStockThreshold?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface MatrixCell {
  /** `<group ref>=<value ref>` pairs sorted by group ref. Stable for a saved
   * combination, which is how a row keeps its figures across a re-render. */
  key: string;
  selections: Record<string, string>;
  parts: { group: string; value: string; colorHex: string }[];
}

export const PRESET_GROUPS: { name: string; display: OptionDisplay }[] = [
  { name: "Color", display: "swatch" },
  { name: "Size", display: "pill" },
  { name: "Storage", display: "pill" },
  { name: "Volume", display: "pill" },
  { name: "Material", display: "pill" },
  { name: "Style", display: "pill" },
];

export function newRef(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyValue(): BuilderValue {
  return {
    ref: newRef("v"),
    id: null,
    label: "",
    colorHex: "",
    imageUrl: "",
    isActive: true,
    persisted: false,
  };
}

export function emptyGroup(name = "", display: OptionDisplay = "pill"): BuilderGroup {
  return {
    ref: newRef("g"),
    id: null,
    name,
    display,
    showLabels: true,
    isActive: true,
    values: [emptyValue()],
    persisted: false,
  };
}

/** Loads what the product already has into editing state. */
export function groupsFromProduct(groups: EditableOptionGroup[]): BuilderGroup[] {
  return groups.map((group) => ({
    ref: group.id,
    id: group.id,
    name: group.name,
    display: group.display,
    showLabels: group.showLabels,
    isActive: group.isActive,
    persisted: true,
    values: group.values.map((value) => ({
      ref: value.id,
      id: value.id,
      label: value.label,
      colorHex: value.colorHex ?? "",
      imageUrl: value.imageUrl ?? "",
      isActive: value.isActive,
      persisted: true,
    })),
  }));
}

/** The figures each existing combination already carries, keyed the same way
 * the matrix keys its rows -- so a retired combination brought back shows the
 * stock, SKU and price it kept while it was off rather than a set of zeros.
 *
 * A variant is inactive for one of two reasons, and they are not the same
 * thing. Either the admin switched that combination off -- "Olive in L does not
 * exist" -- or one of the values it carries was retired, which took its
 * combinations down with it. Only the first is the row's own state. If the
 * second were loaded as the row's own state, turning the value back on would
 * bring the row back still switched off, and nothing would ever be for sale
 * again. So a variant whose options are no longer all active loads with its own
 * switch on: it is simply not offered while the value is. */
export function cellsFromVariants(
  variants: EditableVariant[],
  groups: EditableOptionGroup[]
): Record<string, CellOverride> {
  const liveValueIds = new Set(
    groups
      .filter((group) => group.isActive)
      .flatMap((group) => group.values.filter((value) => value.isActive).map((value) => value.id))
  );

  const cells: Record<string, CellOverride> = {};
  for (const variant of variants) {
    const key = keyFromSelections(variant.selections);
    const optionsStillOffered = Object.values(variant.selections).every((valueId) =>
      liveValueIds.has(valueId)
    );
    cells[key] = {
      sku: variant.sku ?? "",
      price: variant.price === null ? "" : String(variant.price),
      oldPrice: variant.oldPrice === null || variant.oldPrice === 0 ? "" : String(variant.oldPrice),
      stock: String(variant.stockQuantity),
      lowStockThreshold: String(variant.lowStockThreshold),
      imageUrl: variant.imageUrl ?? "",
      isActive: variant.isActive || !optionsStillOffered,
    };
  }
  return cells;
}

export function keyFromSelections(selections: Record<string, string>): string {
  return Object.keys(selections)
    .sort()
    .map((groupRef) => `${groupRef}=${selections[groupRef]}`)
    .join("|");
}

/** Every combination the active options imply, in display order.
 *
 * A product with no options still produces exactly one row -- stock lives on a
 * variant, so there is always something to sell. */
export function buildMatrix(groups: BuilderGroup[]): MatrixCell[] {
  const active = groups.filter((group) => group.isActive && group.name.trim());
  let cells: MatrixCell[] = [{ key: "", selections: {}, parts: [] }];

  for (const group of active) {
    const values = group.values.filter((value) => value.isActive && value.label.trim());
    if (values.length === 0) continue;

    const next: MatrixCell[] = [];
    for (const cell of cells) {
      for (const value of values) {
        const selections = { ...cell.selections, [group.ref]: value.ref };
        next.push({
          key: keyFromSelections(selections),
          selections,
          parts: [...cell.parts, { group: group.name, value: value.label, colorHex: value.colorHex }],
        });
      }
    }
    cells = next;
  }

  return cells;
}

/** Spreads an entered total across the combinations the way the old
 * create form did: evenly, with the remainder going to the first rows so the
 * numbers still add up to what was typed. */
export function splitStock(total: number, count: number, index: number): number {
  if (count <= 0) return 0;
  const each = Math.floor(total / count);
  const remainder = total - each * count;
  return each + (index < remainder ? 1 : 0);
}

function numberOrNull(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The single hidden field the form posts.
 *
 * Nothing here is trusted by the server: it recomputes each signature, re-reads
 * every stored price and stock figure, and resolves the image URL against the
 * gallery it has just written. This is the admin's intent, not the result. */
export function buildOptionsPayload(params: {
  groups: BuilderGroup[];
  cells: Record<string, CellOverride>;
  matrix: MatrixCell[];
  defaultStock?: number;
  defaultThreshold?: number;
}): string {
  const { groups, cells, matrix, defaultStock, defaultThreshold } = params;

  return JSON.stringify({
    groups: groups
      .filter((group) => group.name.trim())
      .map((group) => ({
        ref: group.ref,
        id: group.id,
        name: group.name.trim(),
        display: group.display,
        showLabels: group.showLabels,
        isActive: group.isActive,
        values: group.values
          .filter((value) => value.label.trim())
          .map((value) => ({
            ref: value.ref,
            id: value.id,
            label: value.label.trim(),
            colorHex: value.colorHex.trim() || null,
            imageUrl: value.imageUrl.trim() || null,
            isActive: value.isActive,
          })),
      })),
    variants: matrix.map((cell, index) => {
      const override = cells[cell.key] ?? {};
      const stock =
        override.stock !== undefined
          ? numberOrNull(override.stock)
          : defaultStock !== undefined
            ? splitStock(defaultStock, matrix.length, index)
            : null;

      return {
        selections: cell.selections,
        sku: (override.sku ?? "").trim() || null,
        price: numberOrNull(override.price),
        oldPrice: numberOrNull(override.oldPrice),
        stock,
        lowStockThreshold:
          numberOrNull(override.lowStockThreshold) ?? defaultThreshold ?? null,
        imageUrl: (override.imageUrl ?? "").trim() || null,
        isActive: override.isActive !== false,
      };
    }),
  });
}
