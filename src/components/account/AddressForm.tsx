"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, CircleAlert } from "lucide-react";
import type { Address } from "@/types";
import { addAddressAction, updateAddressAction, type AddressActionState } from "@/app/account/addresses/actions";
import { useRefreshOnSuccess } from "@/lib/useRefreshOnSuccess";
import LocationPicker, { type LocationValue } from "@/components/address/LocationPicker";
import { isServedLocation } from "@/data/locations";

const LABELS = ["Home", "Work", "Other"];

export default function AddressForm({
  address,
  onDone,
}: {
  address?: Address;
  onDone: () => void;
}) {
  const action = address ? updateAddressAction.bind(null, address.id) : addAddressAction;
  const [state, formAction, pending] = useActionState<AddressActionState, FormData>(action, {});
  useRefreshOnSuccess(state.success, onDone);

  /* The address book used to ask for "Area" and "City" as free text, which is
   * why saved addresses could not prefill the checkout: a typed city is not a
   * division, and the district level was never asked for at all. The same
   * picker the checkout uses now fills all three, so an address saved here is
   * an address an order can actually be placed against. A legacy row that does
   * not form a real division/district/upazila path starts blank rather than
   * showing three names that do not belong together. */
  const [location, setLocation] = useState<LocationValue>(() => {
    const saved = {
      division: address?.city ?? "",
      district: address?.district ?? "",
      area: address?.area ?? "",
    };
    return isServedLocation(saved.division, saved.district, saved.area)
      ? saved
      : { division: "", district: "", area: "" };
  });

  /* Held in state rather than left to the DOM because React clears an
   * uncontrolled field once a form action settles: on a rejected save the
   * typed name, phone and street address would all vanish, leaving the
   * shopper to type them again to fix one thing. */
  const [fields, setFields] = useState({
    label: address?.label ?? "Home",
    fullName: address?.fullName ?? "",
    phone: address?.phone ?? "",
    line1: address?.line1 ?? "",
    postalCode: address?.postalCode ?? "",
    isDefault: address?.isDefault ?? false,
  });

  /* A rejection stays on screen until the next save, so "pick a division" would
   * still be showing in red while the shopper looks at the division they just
   * picked. Any edit hides it again. */
  const [editedSinceSave, setEditedSinceSave] = useState(false);

  function set<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setEditedSinceSave(true);
    setFields((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      action={formAction}
      onSubmit={() => setEditedSinceSave(false)}
      className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card"
    >
      <div className="grid grid-cols-3 gap-1 rounded-full bg-brand-tint p-1">
        {LABELS.map((label) => (
          <label key={label} className="relative">
            <input
              type="radio"
              name="label"
              value={label}
              checked={fields.label === label}
              onChange={() => set("label", label)}
              className="peer sr-only"
            />
            <span className="flex cursor-pointer items-center justify-center rounded-full py-2 text-xs font-semibold text-ink-slate peer-checked:bg-white peer-checked:text-brand-dark peer-checked:shadow-card">
              {label}
            </span>
          </label>
        ))}
      </div>

      <input
        name="fullName"
        value={fields.fullName}
        onChange={(event) => set("fullName", event.target.value)}
        placeholder="Full name"
        required
        className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
      />
      <input
        name="phone"
        value={fields.phone}
        onChange={(event) => set("phone", event.target.value)}
        placeholder="Phone number"
        type="tel"
        required
        className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
      />
      <input
        name="line1"
        value={fields.line1}
        onChange={(event) => set("line1", event.target.value)}
        placeholder="House / Street address"
        required
        className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
      />

      <LocationPicker
        value={location}
        onChange={(patch) => {
          setEditedSinceSave(true);
          setLocation((current) => ({ ...current, ...patch }));
        }}
        names={{ division: "city", district: "district", area: "area" }}
      />

      <input
        name="postalCode"
        value={fields.postalCode}
        onChange={(event) => set("postalCode", event.target.value)}
        placeholder="Postal code (optional)"
        className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
      />

      <label className="flex items-center gap-2 text-xs font-medium text-ink-slate">
        <input
          type="checkbox"
          name="isDefault"
          checked={fields.isDefault}
          onChange={(event) => set("isDefault", event.target.checked)}
          className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
        />
        Set as default address
      </label>

      {state.error && !editedSinceSave && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-red/10 px-4 py-3 text-xs font-medium text-accent-red">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-xl border border-line py-3 text-sm font-semibold text-ink-slate"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-70"
        >
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {address ? "Save Changes" : "Add Address"}
        </button>
      </div>
    </form>
  );
}
