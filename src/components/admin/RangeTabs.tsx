import Link from "next/link";

export type SearchParamsShape = Record<string, string | string[] | undefined>;

const OPTIONS = [
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
  { key: "all", label: "All Time" },
] as const;

/** Rebuilds the current query string with one value swapped, dropping the
 * page number: changing a filter should land you back on page one rather than
 * on page 4 of a result set that no longer has one. */
export function withParam(
  params: SearchParamsShape,
  key: string,
  value: string | undefined
): string {
  const next = new URLSearchParams();

  for (const [name, raw] of Object.entries(params)) {
    if (name === key || name === "page") continue;
    const single = Array.isArray(raw) ? raw[0] : raw;
    if (single) next.set(name, single);
  }
  if (value) next.set(key, value);

  const query = next.toString();
  return query ? `?${query}` : "";
}

/** The date-window control that sits above every chart and table.
 *
 * Built from links rather than a client-side select so the page stays a server
 * component: the chosen window lives in the URL, which also means a filtered
 * view can be bookmarked and shared. */
export default function RangeTabs({
  base,
  params,
  current,
  compact = false,
}: {
  base: string;
  params: SearchParamsShape;
  current: string;
  compact?: boolean;
}) {
  return (
    // Capped at the container and scrollable: four nowrap labels are wider than
    // a phone, and without the cap they would stretch the card that holds them.
    <div className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-neutral-50 p-1">
      {OPTIONS.map((option) => {
        const active = option.key === current;
        return (
          <Link
            key={option.key}
            href={`${base}${withParam(params, "range", option.key)}`}
            aria-current={active ? "true" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
              active
                ? "bg-white text-brand shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {compact ? option.label.replace("Last ", "") : option.label}
          </Link>
        );
      })}
    </div>
  );
}
