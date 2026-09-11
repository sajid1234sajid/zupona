"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Trash2, Plus, LoaderCircle } from "lucide-react";
import type { Address } from "@/types";
import { formatAddressLine } from "@/lib/format";
import { deleteAddressAction, setDefaultAddressAction } from "@/app/account/addresses/actions";
import AddressForm from "./AddressForm";

export default function AddressesClient({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "add" | string>("list");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (view === "add") {
    return <AddressForm onDone={() => setView("list")} />;
  }

  const editing = addresses.find((a) => a.id === view);
  if (editing) {
    return <AddressForm address={editing} onDone={() => setView("list")} />;
  }

  function remove(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await deleteAddressAction(id);
      router.refresh();
      setPendingId(null);
    });
  }

  function setDefault(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await setDefaultAddressAction(id);
      router.refresh();
      setPendingId(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {addresses.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white py-10 text-center shadow-sm">
          <MapPin className="h-6 w-6 text-ink-faint" />
          <p className="text-sm font-semibold text-ink-slate">No saved addresses yet</p>
          <p className="max-w-[220px] text-xs text-ink-slate">
            Add a delivery address to speed up checkout.
          </p>
        </div>
      )}

      {addresses.map((address) => (
        <div key={address.id} className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand-dark">
                {address.label}
              </span>
              {address.isDefault && (
                <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
                  Default
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button aria-label="Edit address" onClick={() => setView(address.id)} className="text-ink-slate">
                <Pencil className="h-4 w-4" />
              </button>
              <button
                aria-label="Delete address"
                disabled={pendingId === address.id}
                onClick={() => remove(address.id)}
                className="text-accent-red"
              >
                {pendingId === address.id ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm font-semibold text-heading">{address.fullName}</p>
          <p className="text-xs text-ink-slate">{address.phone}</p>
          <p className="mt-1 text-xs text-ink-slate">{formatAddressLine(address)}</p>
          {!address.isDefault && (
            <button
              onClick={() => setDefault(address.id)}
              disabled={pendingId === address.id}
              className="mt-3 text-xs font-semibold text-brand"
            >
              Set as default
            </button>
          )}
        </div>
      ))}

      <button
        onClick={() => setView("add")}
        className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-brand/40 py-3.5 text-sm font-semibold text-brand"
      >
        <Plus className="h-4 w-4" />
        Add New Address
      </button>
    </div>
  );
}
