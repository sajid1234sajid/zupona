"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Search, X } from "lucide-react";
import { divisionNames, districtsForDivision, upazilasForDistrict } from "@/data/locations";

export interface LocationValue {
  division: string;
  district: string;
  area: string;
}

type Level = "division" | "district" | "area";

const LEVEL_LABEL: Record<Level, string> = {
  division: "Division",
  district: "District",
  area: "Area / Thana",
};

/** The three fields of a Bangladeshi address: division -> district -> upazila.
 *
 * These used to be native <select> elements hidden at zero opacity underneath a
 * drawn card. Two of the three were also `disabled` until the level above them
 * had been chosen, so a shopper who tapped "District" first -- the obvious
 * thing to do, since it sits right beside "Division" -- got a control that did
 * nothing at all, with no way to find out why.
 *
 * So the list is drawn in the page instead: a sheet with the real options in
 * it, searchable, because Dhaka district alone has fifty thanas and scrolling a
 * native picker down to "Sher-e-Bangla Nagar" is not something anyone wants to
 * do. Nothing is disabled either -- a field whose parent is still empty opens
 * and offers that parent, rather than refusing the tap in silence.
 */
export default function LocationPicker({
  value,
  onChange,
  names,
}: {
  value: LocationValue;
  onChange: (patch: Partial<LocationValue>) => void;
  /** Field names for the hidden inputs, when this sits in a plain <form>. */
  names?: { division: string; district: string; area: string };
}) {
  const [open, setOpen] = useState<Level | null>(null);

  const districts = useMemo(() => districtsForDivision(value.division), [value.division]);
  const areas = useMemo(
    () => upazilasForDistrict(value.division, value.district),
    [value.division, value.district]
  );

  const optionsFor: Record<Level, string[]> = {
    division: divisionNames,
    district: districts,
    area: areas,
  };

  const chosen: Record<Level, string> = {
    division: value.division,
    district: value.district,
    area: value.area,
  };

  function choose(level: Level, name: string) {
    if (level === "division") onChange({ division: name, district: "", area: "" });
    else if (level === "district") onChange({ district: name, area: "" });
    else onChange({ area: name });
    setOpen(null);
  }

  /* Which level above this one is still empty, if any. The sheet offers that
   * one instead of showing an empty list. */
  function blockedBy(level: Level): Level | null {
    if (level === "district") return value.division ? null : "division";
    if (level === "area") {
      if (!value.division) return "division";
      if (!value.district) return "district";
    }
    return null;
  }

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Field
          label={LEVEL_LABEL.division}
          value={value.division}
          placeholder="Select"
          onOpen={() => setOpen("division")}
        />
        <Field
          label={LEVEL_LABEL.district}
          value={value.district}
          placeholder={value.division ? "Select" : "Pick a division"}
          onOpen={() => setOpen("district")}
        />
      </div>

      <Field
        label={LEVEL_LABEL.area}
        value={value.area}
        placeholder={value.district ? "Select" : "Pick a district"}
        onOpen={() => setOpen("area")}
      />

      {names && (
        <>
          <input type="hidden" name={names.division} value={value.division} />
          <input type="hidden" name={names.district} value={value.district} />
          <input type="hidden" name={names.area} value={value.area} />
        </>
      )}

      {open && (
        <OptionSheet
          title={LEVEL_LABEL[open]}
          options={optionsFor[open]}
          selected={chosen[open]}
          blockedBy={blockedBy(open)}
          onPickBlocker={(level) => setOpen(level)}
          onSelect={(name) => choose(open, name)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/** The drawn card: pale pin tile, label above the chosen value, chevron. */
function Field({
  label,
  value,
  placeholder,
  onOpen,
}: {
  label: string;
  value: string;
  placeholder: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="listbox"
      className="flex w-full items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-2 text-left focus:border-brand focus:outline-none"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
        <MapPin className="h-3.5 w-3.5 text-brand" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold text-ink-slate">{label}</span>
        <span
          className={`block truncate text-[12px] font-semibold ${
            value ? "text-ink-strong" : "text-ink-faint"
          }`}
        >
          {value || placeholder}
        </span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-ink-slate" />
    </button>
  );
}

/** The list itself, as a sheet over the page so no ancestor's clipping can
 * hide it, with a search box once the list is long enough to need one. */
function OptionSheet({
  title,
  options,
  selected,
  blockedBy,
  onPickBlocker,
  onSelect,
  onClose,
}: {
  title: string;
  options: string[];
  selected: string;
  blockedBy: Level | null;
  onPickBlocker: (level: Level) => void;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchable = !blockedBy && options.length > 8;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (searchable) searchRef.current?.focus();
  }, [searchable]);

  const needle = query.trim().toLowerCase();
  const shown = needle ? options.filter((name) => name.toLowerCase().includes(needle)) : options;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-strong/40 tab:items-center"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-card tab:rounded-2xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <h3 className="flex-1 text-sm font-bold text-ink-strong">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-mist text-ink-slate"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {blockedBy ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[13px] text-ink-slate">
              Pick a {LEVEL_LABEL[blockedBy].toLowerCase()} first — the {title.toLowerCase()} list
              depends on it.
            </p>
            <button
              type="button"
              onClick={() => onPickBlocker(blockedBy)}
              className="mt-3 rounded-full btn-brand px-5 py-2 text-[13px] font-bold text-white"
            >
              Choose {LEVEL_LABEL[blockedBy].toLowerCase()}
            </button>
          </div>
        ) : (
          <>
            {searchable && (
              <div className="flex items-center gap-2 border-b border-line px-4 py-2">
                <Search className="h-4 w-4 shrink-0 text-ink-slate" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${title.toLowerCase()}`}
                  className="w-full border-0 py-1 text-[13px] text-ink-strong outline-none placeholder:text-ink-faint"
                />
              </div>
            )}

            <ul role="listbox" aria-label={title} className="min-h-0 flex-1 overflow-y-auto py-1">
              {shown.map((name) => {
                const active = name === selected;
                return (
                  <li key={name}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => onSelect(name)}
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] ${
                        active ? "font-bold text-brand-dark" : "text-ink-strong"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-brand" />}
                    </button>
                  </li>
                );
              })}
              {shown.length === 0 && (
                <li className="px-4 py-6 text-center text-[13px] text-ink-slate">
                  No {title.toLowerCase()} matches that search.
                </li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
