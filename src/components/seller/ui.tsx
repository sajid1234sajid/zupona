import Link from "next/link";

/** searchParams values are `string | string[]`; every filter in the Seller
 * Center is single-valued, so the first entry is the one that counts. */
export function one(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single || undefined;
}

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  href: string;
  /** Draws the count in the warning colour -- work waiting on the seller. */
  urgent?: boolean;
}

/** The status tabs above a list. Links rather than client state, so the page
 * stays a server component and a filtered view survives a reload or a share.
 * The strip scrolls sideways on a phone rather than wrapping into a wall. */
export function Tabs({ items, current }: { items: TabItem[]; current: string }) {
  return (
    <nav
      aria-label="Filter"
      className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:px-0"
    >
      {items.map((item) => {
        const active = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
              active
                ? "border-brand bg-brand text-white"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-brand/40 hover:text-brand"
            }`}
          >
            {item.label}
            {item.count !== undefined ? (
              <span
                className={`min-w-5 rounded-full px-1.5 py-px text-center text-[11px] ${
                  active
                    ? "bg-white/20 text-white"
                    : item.urgent && item.count > 0
                      ? "bg-amber-100 text-amber-800"
                      : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** A row in a definition list: label on the left, value on the right. */
export function Row({
  label,
  children,
  strong = false,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className={strong ? "font-medium text-neutral-700" : "text-neutral-500"}>{label}</dt>
      <dd className={`min-w-0 text-right ${strong ? "font-bold text-neutral-900" : "font-medium text-neutral-800"}`}>
        {children}
      </dd>
    </div>
  );
}
