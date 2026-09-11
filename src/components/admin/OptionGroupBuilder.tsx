"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, X } from "lucide-react";
import type { OptionDisplay } from "@/lib/optionModel";
import {
  emptyGroup,
  emptyValue,
  PRESET_GROUPS,
  type BuilderGroup,
  type BuilderValue,
} from "./optionBuilder";
import { buttonStyles, fieldStyles } from "./ui";

/** However many options a product actually has, named by whoever uploads it.
 *
 * The two fixed Colour and Size fields this replaces could describe a shirt and
 * nothing else. A phone needs Storage, a serum needs Volume, a rug needs
 * Material, and a watch needs only a colour -- so a group is just a name, a way
 * of drawing it, and a list of values.
 *
 * A saved value is never removed, only turned off. Variants, cart lines and
 * order history point at it, so deleting one would strip the record of what was
 * sold; turning it off stops it being offered and keeps all of that. Only a
 * value that has never been saved gets a delete button. */

const DISPLAYS: { value: OptionDisplay; label: string; hint: string }[] = [
  { value: "swatch", label: "Swatch", hint: "Colour circles" },
  { value: "pill", label: "Pill", hint: "Text buttons" },
  { value: "image", label: "Image", hint: "Picture per value" },
  { value: "dropdown", label: "Dropdown", hint: "A select list" },
];

export default function OptionGroupBuilder({
  groups,
  onChange,
  maxGroups,
  maxValues,
}: {
  groups: BuilderGroup[];
  onChange: (groups: BuilderGroup[]) => void;
  maxGroups: number;
  maxValues: number;
}) {
  const patchGroup = (index: number, patch: Partial<BuilderGroup>) =>
    onChange(groups.map((group, i) => (i === index ? { ...group, ...patch } : group)));

  const patchValue = (groupIndex: number, valueIndex: number, patch: Partial<BuilderValue>) =>
    patchGroup(groupIndex, {
      values: groups[groupIndex].values.map((value, i) =>
        i === valueIndex ? { ...value, ...patch } : value
      ),
    });

  const moveGroup = (index: number, by: number) => {
    const target = index + by;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const moveValue = (groupIndex: number, index: number, by: number) => {
    const values = [...groups[groupIndex].values];
    const target = index + by;
    if (target < 0 || target >= values.length) return;
    [values[index], values[target]] = [values[target], values[index]];
    patchGroup(groupIndex, { values });
  };

  const usedNames = new Set(groups.map((group) => group.name.trim().toLowerCase()));

  return (
    <div className="space-y-3">
      {groups.map((group, groupIndex) => {
        const retiredValues = group.values.filter((value) => !value.isActive).length;

        return (
          <div
            key={group.ref}
            className={`rounded-xl border p-3.5 transition ${
              group.isActive ? "border-neutral-200 bg-white" : "border-dashed border-neutral-200 bg-neutral-50"
            }`}
          >
            <div className="flex flex-wrap items-end gap-2.5">
              <label className="min-w-0 flex-1 basis-40">
                <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">
                  Option name
                </span>
                <input
                  value={group.name}
                  maxLength={40}
                  onChange={(event) => patchGroup(groupIndex, { name: event.target.value })}
                  placeholder="Colour, Storage, Material…"
                  className={fieldStyles}
                />
              </label>

              <label className="min-w-0 basis-36">
                <span className="mb-1.5 block text-[11px] font-medium text-neutral-500">
                  Shown as
                </span>
                <select
                  value={group.display}
                  onChange={(event) =>
                    patchGroup(groupIndex, { display: event.target.value as OptionDisplay })
                  }
                  className={fieldStyles}
                >
                  {DISPLAYS.map((display) => (
                    <option key={display.value} value={display.value} title={display.hint}>
                      {display.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveGroup(groupIndex, -1)}
                  disabled={groupIndex === 0}
                  aria-label={`Move ${group.name || "option"} up`}
                  className={`${buttonStyles.ghost} h-9 w-9 p-0 disabled:opacity-30`}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveGroup(groupIndex, 1)}
                  disabled={groupIndex === groups.length - 1}
                  aria-label={`Move ${group.name || "option"} down`}
                  className={`${buttonStyles.ghost} h-9 w-9 p-0 disabled:opacity-30`}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => patchGroup(groupIndex, { isActive: !group.isActive })}
                  aria-pressed={group.isActive}
                  aria-label={`${group.isActive ? "Turn off" : "Turn on"} ${group.name || "this option"}`}
                  title={
                    group.isActive
                      ? "Stop offering this option. Its combinations are retired, keeping their stock."
                      : "Offer this option again"
                  }
                  className={`${buttonStyles.ghost} h-9 w-9 p-0 ${group.isActive ? "text-brand" : ""}`}
                >
                  {group.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                {group.persisted ? null : (
                  <button
                    type="button"
                    onClick={() => onChange(groups.filter((_, i) => i !== groupIndex))}
                    aria-label={`Remove ${group.name || "this option"}`}
                    className={`${buttonStyles.ghost} h-9 w-9 p-0 hover:text-accent-red`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-[11px] text-neutral-500">
              <input
                type="checkbox"
                checked={group.showLabels}
                onChange={(event) => patchGroup(groupIndex, { showLabels: event.target.checked })}
                className="h-3.5 w-3.5 accent-[#16a34a]"
              />
              Print the value name beside the selector
            </label>

            <div className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
              {group.values.map((value, valueIndex) => (
                <div
                  key={value.ref}
                  className={`flex flex-wrap items-center gap-1.5 rounded-lg px-1.5 py-1.5 ${
                    value.isActive ? "" : "bg-neutral-100/70"
                  }`}
                >
                  {group.display === "swatch" ? (
                    <span
                      aria-hidden
                      className="h-6 w-6 shrink-0 rounded-full border border-black/10"
                      style={{ background: value.colorHex || "#e5e7eb" }}
                    />
                  ) : null}

                  <input
                    value={value.label}
                    maxLength={60}
                    onChange={(event) =>
                      patchValue(groupIndex, valueIndex, { label: event.target.value })
                    }
                    placeholder="Value name"
                    aria-label={`${group.name || "Option"} value ${valueIndex + 1}`}
                    className="h-9 min-w-0 flex-1 basis-32 rounded-lg border border-neutral-200 px-2.5 text-sm outline-none focus:border-brand"
                  />

                  {group.display === "swatch" ? (
                    <input
                      value={value.colorHex}
                      maxLength={120}
                      onChange={(event) =>
                        patchValue(groupIndex, valueIndex, { colorHex: event.target.value })
                      }
                      placeholder="#111827 or a gradient"
                      aria-label={`${value.label || "Value"} colour`}
                      className="h-9 min-w-0 basis-40 rounded-lg border border-neutral-200 px-2.5 text-xs outline-none focus:border-brand"
                    />
                  ) : null}

                  {group.display === "image" ? (
                    <input
                      value={value.imageUrl}
                      maxLength={500}
                      onChange={(event) =>
                        patchValue(groupIndex, valueIndex, { imageUrl: event.target.value })
                      }
                      placeholder="Image URL"
                      aria-label={`${value.label || "Value"} image`}
                      className="h-9 min-w-0 basis-40 rounded-lg border border-neutral-200 px-2.5 text-xs outline-none focus:border-brand"
                    />
                  ) : null}

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveValue(groupIndex, valueIndex, -1)}
                      disabled={valueIndex === 0}
                      aria-label={`Move ${value.label || "value"} up`}
                      className={`${buttonStyles.ghost} h-8 w-8 p-0 disabled:opacity-30`}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveValue(groupIndex, valueIndex, 1)}
                      disabled={valueIndex === group.values.length - 1}
                      aria-label={`Move ${value.label || "value"} down`}
                      className={`${buttonStyles.ghost} h-8 w-8 p-0 disabled:opacity-30`}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        patchValue(groupIndex, valueIndex, { isActive: !value.isActive })
                      }
                      aria-pressed={value.isActive}
                      aria-label={`${value.isActive ? "Retire" : "Restore"} value ${value.label || valueIndex + 1}`}
                      title={
                        value.isActive
                          ? "Stop offering this value. Its combinations keep their stock and can be brought back."
                          : "Offer this value again"
                      }
                      className={`${buttonStyles.ghost} h-8 w-8 p-0 ${value.isActive ? "text-brand" : ""}`}
                    >
                      {value.isActive ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {value.persisted ? null : (
                      <button
                        type="button"
                        onClick={() =>
                          patchGroup(groupIndex, {
                            values: group.values.filter((_, i) => i !== valueIndex),
                          })
                        }
                        aria-label={`Remove ${value.label || "this value"}`}
                        className={`${buttonStyles.ghost} h-8 w-8 p-0 hover:text-accent-red`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    patchGroup(groupIndex, { values: [...group.values, emptyValue()] })
                  }
                  disabled={group.values.length >= maxValues}
                  className={`${buttonStyles.ghost} disabled:opacity-40`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add value
                </button>
                {retiredValues > 0 ? (
                  <span className="text-[11px] text-neutral-400">
                    {retiredValues} retired — kept so their stock and history survive
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange([...groups, emptyGroup()])}
          disabled={groups.length >= maxGroups}
          className={`${buttonStyles.secondary} h-9 px-3 py-0 text-[13px] disabled:opacity-40`}
        >
          <Plus className="h-4 w-4" />
          Add option
        </button>

        {groups.length < maxGroups
          ? PRESET_GROUPS.filter(
              (preset) => !usedNames.has(preset.name.toLowerCase())
            ).map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => onChange([...groups, emptyGroup(preset.name, preset.display)])}
                className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 transition hover:bg-brand-tint hover:text-brand-dark"
              >
                + {preset.name}
              </button>
            ))
          : null}

        {groups.length >= maxGroups ? (
          <span className="text-[11px] text-neutral-400">Up to {maxGroups} options per product.</span>
        ) : null}
      </div>
    </div>
  );
}
