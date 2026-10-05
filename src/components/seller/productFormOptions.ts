import type { PublishOption } from "@/components/admin/ProductForm";
import type { AutoFitMode } from "@/components/admin/ImageUploader";

/** How each status reads on the Seller Center's Publish card. */
const LABELS: Record<string, PublishOption> = {
  active: { value: "active", label: "Live", detail: "On the storefront now" },
  pending_review: {
    value: "pending_review",
    label: "Submit for review",
    detail: "Zupona checks it, then it goes live",
  },
  draft: { value: "draft", label: "Draft", detail: "Saved, not shown to shoppers" },
  archived: { value: "archived", label: "Archived", detail: "Retired; order history kept" },
};

/** The radio buttons for the statuses `statusesFor()` allows. */
export function publishOptionsFor(statuses: string[]): PublishOption[] {
  return statuses.map((status) => LABELS[status]).filter(Boolean);
}

/** The AI picture fill spends the platform's AI allowance, which the owner's
 * own uploads depend on. Sellers get the blurred fill instead -- the picture
 * is still fitted to the product frame whole, only the surround differs. */
export function sellerAutoFit(mode: AutoFitMode): AutoFitMode {
  return mode === "ai" ? "blur" : mode;
}
