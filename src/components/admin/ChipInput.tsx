"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

interface ChipInputProps {
  /** Posted as one comma-separated value under this name. */
  name: string;
  initial?: string[];
  placeholder?: string;
  /** Optional one-tap values, e.g. common sizes. */
  suggestions?: string[];
  /** Renders a colour dot beside each chip, for the colour field. */
  swatches?: boolean;
}

/** Reads back the CSS colour a value names, so "Navy" and "#123524" both show
 * a dot. Unknown words fall back to a neutral chip rather than an empty gap. */
const NAMED_COLORS: Record<string, string> = {
  black: "#111827",
  white: "#ffffff",
  grey: "#9ca3af",
  gray: "#9ca3af",
  silver: "#d1d5db",
  red: "#ef4444",
  maroon: "#7f1d1d",
  pink: "#ec4899",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#16a34a",
  olive: "#65a30d",
  teal: "#14b8a6",
  blue: "#3b82f6",
  navy: "#1e3a8a",
  purple: "#8b5cf6",
  brown: "#92400e",
  beige: "#e7d8b1",
  cream: "#f5efe0",
  gold: "#d4af37",
};

function swatchFor(value: string): string | null {
  const key = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3,8}$/i.test(key)) return key;
  return NAMED_COLORS[key] ?? null;
}

/** A tag field: type a value, press Enter or comma, get a removable chip.
 *
 * The chips are posted as a single comma-separated string so the server action
 * reads one field rather than an unknown number of repeated ones. */
export default function ChipInput({
  name,
  initial = [],
  placeholder = "Type and press Enter",
  suggestions = [],
  swatches = false,
}: ChipInputProps) {
  const [values, setValues] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const value = raw.trim().replace(/,+$/, "");
    if (!value) return;
    setValues((current) =>
      current.some((entry) => entry.toLowerCase() === value.toLowerCase())
        ? current
        : [...current, value]
    );
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
      // Backspace on an empty field removes the last chip, which is what every
      // other tag field does.
      setValues((current) => current.slice(0, -1));
    }
  };

  return (
    <div>
      <input type="hidden" name={name} value={values.join(",")} />

      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-2 transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
        {values.map((value) => {
          const color = swatches ? swatchFor(value) : null;
          return (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-tint px-2 py-1 text-xs font-medium text-brand-dark"
            >
              {color ? (
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-full border border-black/10"
                  style={{ background: color }}
                />
              ) : null}
              {value}
              <button
                type="button"
                onClick={() => setValues((current) => current.filter((entry) => entry !== value))}
                aria-label={`Remove ${value}`}
                className="text-brand-dark/50 transition hover:text-accent-red"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}

        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={values.length === 0 ? placeholder : ""}
          aria-label={placeholder}
          className="min-w-[7rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />
      </div>

      {suggestions.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestions
            .filter((entry) => !values.some((value) => value.toLowerCase() === entry.toLowerCase()))
            .map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => add(entry)}
                className="rounded-lg border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-500 transition hover:border-brand hover:text-brand"
              >
                + {entry}
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}
