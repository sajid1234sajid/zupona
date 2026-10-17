/** The size guide the owner types into Settings, as a table.
 *
 * Kept as plain text so it can be written without a table editor: the first
 * line names the columns, each line after it is one size, cells split by "|"
 * or ",". Measurements are in inches; the product page converts to cm. E.g.
 *
 *   Size | Chest | Length | Sleeve
 *   M    | 40    | 28     | 24
 *   L    | 42    | 29     | 24.5
 *
 * No database here, so the product page's client code can parse it too. */

export interface SizeGuide {
  columns: string[];
  rows: { size: string; values: (number | null)[] }[];
}

export const SIZE_GUIDE_MAX_LENGTH = 2000;

export function parseSizeGuide(raw: string | null | undefined): SizeGuide | null {
  const lines = (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const split = (line: string) => line.split(/\s*[|,]\s*/).map((cell) => cell.trim());
  const header = split(lines[0]);
  if (header.length < 2) return null;
  const columns = header.slice(1);
  const rows = lines.slice(1).map((line) => {
    const cells = split(line);
    return {
      size: cells[0] ?? "",
      values: columns.map((_, index) => {
        const value = Number.parseFloat(cells[index + 1] ?? "");
        return Number.isFinite(value) ? value : null;
      }),
    };
  });
  const usable = rows.filter((row) => row.size && row.values.some((value) => value !== null));
  return usable.length > 0 ? { columns, rows: usable } : null;
}

/** Inches to centimetres, to one decimal. */
export function toCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}
