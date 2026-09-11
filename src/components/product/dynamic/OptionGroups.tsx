"use client";

import Image from "next/image";
import type { StoreOptionGroup, StoreVariant } from "@/lib/storefront";
import { isValueAvailable, type Selections } from "./variantMatching";

/** The option selectors, drawn from whatever options the product has.
 *
 * There is no colour selector and no size selector here -- there is one
 * selector that renders a group, and a product brings as many groups as it
 * sells: a watch one, a shirt Colour and Size, a phone Storage and Colour, a
 * serum Volume. A product with no groups renders nothing at all, which is what
 * stops an empty "Color" heading appearing above a product that has none.
 *
 * A value that cannot be reached from the current selection is disabled rather
 * than hidden, so the shopper can see that Olive exists and is simply not made
 * in L, instead of watching options vanish as they choose. */
export default function OptionGroups({
  groups,
  variants,
  selections,
  onSelect,
}: {
  groups: StoreOptionGroup[];
  variants: StoreVariant[];
  selections: Selections;
  onSelect: (groupKey: string, value: string) => void;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const chosen = selections[group.key];
        const chosenLabel = group.values.find((value) => value.value === chosen)?.label;

        return (
          <fieldset key={group.id} className="border-0 p-0">
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <legend className="text-sm font-bold text-heading">{group.name}</legend>
              <span className="truncate text-xs text-ink-soft">{chosenLabel ?? "Select"}</span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {group.values.map((value) => {
                const selected = chosen === value.value;
                const enabled = isValueAvailable(variants, selections, group.key, value.value);
                const common =
                  "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35";

                // A swatch with its name underneath, a swatch on its own, or a
                // pill -- whichever the product says this group is drawn as.
                if (group.display === "swatch" || group.display === "image") {
                  const dot = (
                    <span
                      className={`grid place-items-center overflow-hidden rounded-full ${
                        group.showLabels ? "h-12 w-12" : "h-10 w-10"
                      } ${selected ? "ring-2 ring-brand ring-offset-2" : "ring-1 ring-black/10"}`}
                      style={value.imageUrl ? undefined : { background: value.colorHex ?? "#dfe8e3" }}
                    >
                      {value.imageUrl && (
                        <Image
                          src={value.imageUrl}
                          alt=""
                          width={48}
                          height={48}
                          className="h-full w-full object-cover"
                          unoptimized={value.imageUrl.startsWith("/api/media/")}
                        />
                      )}
                    </span>
                  );

                  return (
                    <button
                      key={value.id}
                      type="button"
                      disabled={!enabled}
                      aria-pressed={selected}
                      aria-label={`${group.name}: ${value.label}${enabled ? "" : " (unavailable)"}`}
                      onClick={() => onSelect(group.key, value.value)}
                      className={`flex min-h-[44px] flex-col items-center gap-1 ${common}`}
                    >
                      {dot}
                      {group.showLabels && (
                        <span
                          className={`max-w-[72px] truncate text-[11px] font-semibold ${
                            selected ? "text-brand-darkest" : "text-ink-soft"
                          }`}
                        >
                          {value.label}
                        </span>
                      )}
                    </button>
                  );
                }

                return (
                  <button
                    key={value.id}
                    type="button"
                    disabled={!enabled}
                    aria-pressed={selected}
                    aria-label={`${group.name}: ${value.label}${enabled ? "" : " (unavailable)"}`}
                    onClick={() => onSelect(group.key, value.value)}
                    className={`min-h-[44px] min-w-[52px] rounded-xl border px-3.5 text-sm font-bold ${common} ${
                      selected
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-white text-heading"
                    }`}
                  >
                    {value.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
