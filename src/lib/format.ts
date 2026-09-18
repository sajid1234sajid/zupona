export const CURRENCY = "৳";

export function formatPrice(amount: number): string {
  return `${CURRENCY} ${amount.toLocaleString("en-US")}`;
}

/** One line, narrowest place first: street, thana, district, division, code.
 *
 * The district sits between thana and division because that is the order a
 * Bangladeshi address is written and read in -- "Laksam, Cumilla, Chattogram"
 * tells a rider where to go; "Laksam, Chattogram" does not. */
export function formatAddressLine(address: {
  line1: string;
  area?: string | null;
  district?: string | null;
  city: string;
  postalCode?: string | null;
}): string {
  return [address.line1, address.area, address.district, address.city, address.postalCode]
    .filter(Boolean)
    .join(", ");
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

/** Every clock on the site reads Bangladesh time. The Worker runs in UTC, so
 * a date formatted without this shows the shopper's 4:20 PM order as 10:20 AM. */
export const SHOP_TIME_ZONE = "Asia/Dhaka";

/** SQLite writes `datetime('now')` as "YYYY-MM-DD HH:MM:SS" in UTC, which is
 * not a format `new Date()` parses consistently across engines. This turns it
 * into a real Date; ISO strings pass through untouched. */
export function parseDbDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null | undefined): string {
  const date = parseDbDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: SHOP_TIME_ZONE,
  });
}

export function formatDateTime(value: string | null | undefined): string {
  const date = parseDbDate(value);
  if (!date) return "—";
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: SHOP_TIME_ZONE,
  })} · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: SHOP_TIME_ZONE })}`;
}

/** "3 mins ago" for anything recent, falling back to a date past a week so an
 * activity feed doesn't end in "412 days ago". */
export function formatRelative(value: string | null | undefined): string {
  const date = parseDbDate(value);
  if (!date) return "—";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return formatDate(value);
}

/** Compact figures for stat tiles and chart axes: 12480 -> "12.5K". */
export function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return String(Math.round(amount));
}

export function formatCompactPrice(amount: number): string {
  return `${CURRENCY}${formatCompact(amount)}`;
}
