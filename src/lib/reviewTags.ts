/** The fixed words a reviewer can pick, and what a review's fit means.
 *
 * A fixed list rather than free text, so "Good quality (35)" can be counted
 * and a tag can be tapped to filter. No database import: the review form and
 * the review list in the browser both read it. */

export const REVIEW_TAGS = [
  { id: "quality", label: "Good quality" },
  { id: "value", label: "Value for money" },
  { id: "as_described", label: "As described" },
  { id: "fast_delivery", label: "Fast delivery" },
  { id: "perfect_fit", label: "Perfect fit", apparel: true },
  { id: "packaging", label: "Nice packaging" },
] as const;

export type ReviewTagId = (typeof REVIEW_TAGS)[number]["id"];

export const MAX_REVIEW_TAGS = 3;
export const MAX_REVIEW_PHOTOS = 6;

export function tagLabel(id: string): string | null {
  return REVIEW_TAGS.find((tag) => tag.id === id)?.label ?? null;
}

export function tagsFor(apparel: boolean) {
  return REVIEW_TAGS.filter((tag) => apparel || !("apparel" in tag));
}

export type ReviewFit = "small" | "true" | "large";

export const FIT_LABELS: Record<ReviewFit, string> = {
  small: "Runs small",
  true: "True to size",
  large: "Runs large",
};

export const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** "Ay***ed": enough of a name to be a person, not enough to find them. A
 * name that is really a phone number is not shown at all. */
export function maskName(name: string): string {
  const clean = name.trim();
  if (!clean || /\d{6,}/.test(clean)) return "Zupona customer";
  const chars = Array.from(clean.replace(/\s+/g, ""));
  if (chars.length <= 4) return `${chars[0]}***`;
  return `${chars.slice(0, 2).join("")}***${chars.slice(-2).join("")}`;
}
