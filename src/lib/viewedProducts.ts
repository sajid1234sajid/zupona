/** What this browser has looked at, kept on the device.
 *
 * The home page's "Recently viewed" row and its Recommended order read it;
 * the product page writes it. It lives in localStorage rather than an account
 * because most shoppers browse signed out, and it never leaves the browser.
 * Storage can throw (a private window) or hold anything an older version
 * wrote, so both sides are defensive. */

const KEY = "zupona.viewed";
const LIMIT = 24;

export interface ViewedEntry {
  /** Product id. */
  id: string;
  /** Its department, for "more like what you looked at". */
  c: string | null;
  /** When, in ms. */
  t: number;
}

export function readViewed(): ViewedEntry[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is ViewedEntry =>
            Boolean(entry) && typeof entry.id === "string" && typeof entry.t === "number"
        )
      : [];
  } catch {
    return [];
  }
}

export function recordViewed(id: string, categoryId: string | null) {
  try {
    const next = [{ id, c: categoryId, t: Date.now() }, ...readViewed().filter((e) => e.id !== id)].slice(
      0,
      LIMIT
    );
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* A convenience; a refusal is not worth surfacing. */
  }
}

export function clearViewed() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignored */
  }
}
