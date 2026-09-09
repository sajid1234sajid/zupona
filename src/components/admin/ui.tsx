import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, User, type LucideIcon } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

/** The white panel every admin screen is built from. One component so corner
 * radius, border and shadow stay identical across pages. */
export function Card({
  className = "",
  padded = true,
  children,
}: {
  className?: string;
  padded?: boolean;
  children: ReactNode;
}) {
  // `min-w-0` matters: a grid item defaults to min-width:auto, so without it a
  // wide table or toolbar inside the card widens the whole column and the page
  // scrolls sideways on a phone.
  return (
    <section
      className={`min-w-0 rounded-2xl border border-black/[0.05] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${
        padded ? "p-4 lg:p-5" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-bold text-neutral-800">{title}</h2>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-neutral-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="min-w-0 shrink-0 max-w-full">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  action,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: string[];
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-neutral-900 lg:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-neutral-500">{subtitle}</p> : null}
      </div>
      <div className="flex min-w-0 max-w-full shrink-0 items-center gap-3">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="Breadcrumb" className="hidden text-xs text-neutral-400 sm:block">
            {breadcrumb.map((crumb, index) => (
              <span key={crumb}>
                {index > 0 ? <span className="mx-1.5">›</span> : null}
                <span className={index === breadcrumb.length - 1 ? "text-brand" : undefined}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        ) : null}
        {action}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat tiles                                                                 */
/* -------------------------------------------------------------------------- */

export type StatTone = "green" | "blue" | "orange" | "pink" | "red" | "violet";

const TONES: Record<StatTone, { chip: string; icon: string }> = {
  green: { chip: "bg-emerald-50", icon: "text-emerald-600" },
  blue: { chip: "bg-sky-50", icon: "text-sky-600" },
  orange: { chip: "bg-amber-50", icon: "text-amber-600" },
  pink: { chip: "bg-rose-50", icon: "text-rose-500" },
  red: { chip: "bg-red-50", icon: "text-red-600" },
  violet: { chip: "bg-violet-50", icon: "text-violet-600" },
};

/** A headline figure with its period-over-period movement.
 *
 * `change` is null when there is nothing to compare against — a brand new
 * store — and the caption is dropped rather than showing a meaningless
 * "+100%". */
export function StatCard({
  label,
  value,
  change,
  caption = "vs last 7 days",
  icon: Icon,
  tone = "green",
  href,
}: {
  label: string;
  value: string;
  change?: number | null;
  caption?: string;
  icon: LucideIcon;
  tone?: StatTone;
  href?: string;
}) {
  const palette = TONES[tone];
  const up = (change ?? 0) >= 0;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${palette.chip}`}>
          <Icon className={`h-5 w-5 ${palette.icon}`} />
        </span>
        {change !== null && change !== undefined ? (
          <span
            className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            }`}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(change)}%
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs font-medium text-neutral-400">{label}</p>
      <p className="mt-0.5 truncate text-2xl font-bold text-neutral-900">{value}</p>
      {change !== null && change !== undefined ? (
        <p className="mt-1 text-[11px] text-neutral-400">{caption}</p>
      ) : null}
    </>
  );

  const className =
    "block rounded-2xl border border-black/[0.05] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:shadow-md";

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status pills                                                               */
/* -------------------------------------------------------------------------- */

const STATUS_STYLES: Record<string, string> = {
  // Orders
  placed: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-sky-50 text-sky-700",
  processing: "bg-sky-50 text-sky-700",
  shipped: "bg-violet-50 text-violet-700",
  out_for_delivery: "bg-indigo-50 text-indigo-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
  returned: "bg-neutral-100 text-neutral-600",
  // Payments
  paid: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-600",
  refunded: "bg-neutral-100 text-neutral-600",
  partially_refunded: "bg-neutral-100 text-neutral-600",
  // Products
  active: "bg-emerald-50 text-emerald-700",
  published: "bg-emerald-50 text-emerald-700",
  draft: "bg-neutral-100 text-neutral-600",
  pending_review: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-600",
  archived: "bg-neutral-100 text-neutral-500",
  low_stock: "bg-amber-50 text-amber-700",
  out_of_stock: "bg-red-50 text-red-600",
  // Reviews & moderation
  approved: "bg-emerald-50 text-emerald-700",
  spam: "bg-neutral-800 text-white",
  // Accounts
  suspended: "bg-amber-50 text-amber-700",
  banned: "bg-red-50 text-red-600",
  customer: "bg-neutral-100 text-neutral-600",
  seller: "bg-sky-50 text-sky-700",
  admin: "bg-brand-tint text-brand-dark",
  support: "bg-violet-50 text-violet-700",
};

/** Turns a database status token into the label a person reads. */
export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const style = STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${style}`}
    >
      {label ?? statusLabel(status)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                               */
/* -------------------------------------------------------------------------- */

export function Avatar({
  src,
  name,
  size = 36,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tint text-[11px] font-bold text-brand-dark"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : initials ? (
        initials
      ) : (
        <User className="h-4 w-4" />
      )}
    </span>
  );
}

/** Product thumbnail with a neutral placeholder, so a missing image never
 * collapses a table row's height. */
export function Thumb({
  src,
  alt,
  size = 40,
}: {
  src?: string | null;
  alt: string;
  size?: number;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="text-[9px] font-medium text-neutral-300">No image</span>
      )}
    </span>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-sm font-semibold text-neutral-700">{title}</p>
      {detail ? <p className="mt-1 max-w-sm text-sm text-neutral-400">{detail}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Horizontal scroll container for wide tables. Without this a table forces
 * the whole page to scroll sideways on a phone. */
export function TableScroll({ children }: { children: ReactNode }) {
  // `min-w-0` is what makes `overflow-x-auto` actually contain the table: on
  // its own the scroll box still reports the table's full width to its parent.
  return <div className="-mx-4 min-w-0 overflow-x-auto lg:mx-0">{children}</div>;
}

export function Th({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-400 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-3 py-3 align-middle text-sm text-neutral-700 ${className}`}>
      {children}
    </td>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                 */
/* -------------------------------------------------------------------------- */

/** Rebuilds the current query string with a different page number, so paging
 * preserves every filter the toolbar has set. */
function pageHref(base: string, params: Record<string, string | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function Pagination({
  base,
  params,
  page,
  total,
  pageSize,
  noun = "results",
}: {
  base: string;
  params: Record<string, string | undefined>;
  page: number;
  total: number;
  pageSize: number;
  noun?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  // Show at most five numbered pages, centred on the current one.
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const numbers = Array.from({ length: Math.min(5, pageCount) }, (_, i) => start + i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-1 pt-4">
      <p className="text-xs text-neutral-400">
        Showing {from} to {to} of {total.toLocaleString("en-US")} {noun}
      </p>

      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          <PageLink
            href={pageHref(base, params, Math.max(1, page - 1))}
            disabled={page <= 1}
            label="‹"
            ariaLabel="Previous page"
          />
          {numbers.map((number) => (
            <PageLink
              key={number}
              href={pageHref(base, params, number)}
              label={String(number)}
              current={number === page}
            />
          ))}
          <PageLink
            href={pageHref(base, params, Math.min(pageCount, page + 1))}
            disabled={page >= pageCount}
            label="›"
            ariaLabel="Next page"
          />
        </div>
      ) : null}
    </div>
  );
}

function PageLink({
  href,
  label,
  ariaLabel,
  current = false,
  disabled = false,
}: {
  href: string;
  label: string;
  ariaLabel?: string;
  current?: boolean;
  disabled?: boolean;
}) {
  const className = `flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition ${
    current
      ? "bg-brand text-white"
      : "border border-neutral-200 text-neutral-600 hover:border-brand hover:text-brand"
  }`;

  if (disabled) {
    return (
      <span aria-hidden className={`${className} pointer-events-none opacity-40`}>
        {label}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={ariaLabel} aria-current={current ? "page" : undefined} className={className}>
      {label}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-brand hover:text-brand disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800",
} as const;

/* -------------------------------------------------------------------------- */
/* Form fields                                                                */
/* -------------------------------------------------------------------------- */

export const fieldStyles =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-brand/15";

export const textareaStyles =
  "w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-brand focus:ring-2 focus:ring-brand/15";

export function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-neutral-700">
        {label}
        {required ? <span className="text-accent-red"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-neutral-400">{hint}</span> : null}
    </label>
  );
}

/** Inline result banner for server-action forms. */
export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <p
      role="status"
      className={`rounded-xl px-3.5 py-2.5 text-sm ${
        error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {error ?? success}
    </p>
  );
}
