/** Why a shopper is cancelling, as the cancel picker offers it. Kept apart
 * from the server action, which may only export functions. */
export const CANCEL_REASONS = [
  "Ordered by mistake",
  "Found a better price",
  "Delivery takes too long",
  "Want to change size or colour",
  "Want to change address",
  "Other",
] as const;
