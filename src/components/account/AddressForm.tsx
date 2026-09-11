"use client";

import { useActionState } from "react";
import { LoaderCircle, CircleAlert } from "lucide-react";
import type { Address } from "@/types";
import { addAddressAction, updateAddressAction, type AddressActionState } from "@/app/account/addresses/actions";
import { useRefreshOnSuccess } from "@/lib/useRefreshOnSuccess";

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

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card">
      <div className="grid grid-cols-3 gap-1 rounded-full bg-brand-tint p-1">
        {LABELS.map((label) => (
          <label key={label} className="relative">
            <input
              type="radio"
              name="label"
              value={label}
              defaultChecked={(address?.label ?? "Home") === label}
              className="peer sr-only"
            />
            <span className="flex cursor-pointer items-center justify-center rounded-full py-2 text-xs font-semibold text-brand-dark/50 peer-checked:bg-white peer-checked:text-brand-dark peer-checked:shadow-card">
              {label}
            </span>
          </label>
        ))}
      </div>

      <input
        name="fullName"
        defaultValue={address?.fullName}
        placeholder="Full name"
        required
        className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
      />
      <input
        name="phone"
        defaultValue={address?.phone}
        placeholder="Phone number"
        type="tel"
        required
        className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
      />
      <input
        name="line1"
        defaultValue={address?.line1}
        placeholder="House / Street address"
        required
        className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          name="area"
          defaultValue={address?.area ?? ""}
          placeholder="Area (optional)"
          className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
        />
        <input
          name="city"
          defaultValue={address?.city}
          placeholder="City"
          required
          className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
        />
      </div>
      <input
        name="postalCode"
        defaultValue={address?.postalCode ?? ""}
        placeholder="Postal code (optional)"
        className="rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-brand"
      />

      <label className="flex items-center gap-2 text-xs font-medium text-ink-slate">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={address?.isDefault ?? false}
          className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
        />
        Set as default address
      </label>

      {state.error && (
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
