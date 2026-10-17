/** The words of a return request, shared by the shopper's form, their list
 * and the admin queue. No database here, so client components can import it. */

export type ReturnReason = "damaged" | "wrong_item" | "not_as_described" | "size_issue" | "changed_mind";
export type ReturnResolution = "refund" | "exchange" | "store_credit";
export type RefundMethod = "bkash" | "nagad" | "bank";
export type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "pickup_scheduled"
  | "received"
  | "refunded"
  | "exchanged"
  | "store_credit";

export const RETURN_REASONS: { id: ReturnReason; label: string; photoRequired: boolean; ourFault: boolean }[] = [
  { id: "damaged", label: "Damaged or defective", photoRequired: true, ourFault: true },
  { id: "wrong_item", label: "Wrong item, size or colour sent", photoRequired: true, ourFault: true },
  { id: "not_as_described", label: "Not as described", photoRequired: false, ourFault: true },
  { id: "size_issue", label: "Size doesn't fit", photoRequired: false, ourFault: false },
  { id: "changed_mind", label: "Changed my mind", photoRequired: false, ourFault: false },
];

export const RESOLUTIONS: { id: ReturnResolution; label: string; detail: string }[] = [
  { id: "refund", label: "Refund", detail: "Money back to bKash, Nagad or your bank" },
  { id: "exchange", label: "Exchange", detail: "Another size or colour, if it's in stock" },
  { id: "store_credit", label: "Store credit", detail: "A coupon for the full amount, in My Coupons" },
];

export const REFUND_METHODS: { id: RefundMethod; label: string; placeholder: string }[] = [
  { id: "bkash", label: "bKash", placeholder: "bKash number, e.g. 01XXXXXXXXX" },
  { id: "nagad", label: "Nagad", placeholder: "Nagad number, e.g. 01XXXXXXXXX" },
  { id: "bank", label: "Bank transfer", placeholder: "Account name, number, bank and branch" },
];

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Not approved",
  pickup_scheduled: "Pickup scheduled",
  received: "Received",
  refunded: "Refunded",
  exchanged: "Exchanged",
  store_credit: "Store credit issued",
};

/** Statuses after which nothing more happens to a request. */
export const FINISHED = new Set<ReturnStatus>(["refunded", "exchanged", "store_credit", "rejected"]);

/** The steps a shopper sees, in order. The last one is named by how the
 * return was settled. */
export function returnSteps(status: ReturnStatus, resolution: ReturnResolution): { label: string; done: boolean }[] {
  if (status === "rejected") {
    return [
      { label: "Requested", done: true },
      { label: "Not approved", done: true },
    ];
  }
  const finalLabel =
    status === "refunded" || status === "exchanged" || status === "store_credit"
      ? RETURN_STATUS_LABELS[status]
      : resolution === "exchange"
        ? "Exchanged"
        : resolution === "store_credit"
          ? "Store credit issued"
          : "Refunded";
  const order: ReturnStatus[] = ["requested", "approved", "pickup_scheduled", "received"];
  const reached = FINISHED.has(status) ? order.length : order.indexOf(status);
  return [
    ...order.map((step, index) => ({ label: RETURN_STATUS_LABELS[step], done: index <= reached })),
    { label: finalLabel, done: FINISHED.has(status) },
  ];
}

export const MAX_RETURN_PHOTOS = 4;

export function reasonLabel(id: string): string {
  return RETURN_REASONS.find((reason) => reason.id === id)?.label ?? id;
}

export function resolutionLabel(id: string): string {
  return RESOLUTIONS.find((resolution) => resolution.id === id)?.label ?? id;
}

export function refundMethodLabel(id: string | null): string {
  return REFUND_METHODS.find((method) => method.id === id)?.label ?? "";
}
