"use client";

import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  House,
  Lock,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Truck,
  User,
  Zap,
} from "lucide-react";
import LocationPicker from "@/components/address/LocationPicker";
import { formatBdPhone, normalizeBdPhone, type DeliveryMethod } from "@/lib/checkout";
import type { DeliveryDetails } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import OrderSummary, { type SummaryLine } from "./OrderSummary";

interface StepDeliveryProps {
  details: DeliveryDetails;
  onChange: (patch: Partial<DeliveryDetails>) => void;
  lines: SummaryLine[];
  subtotal: number;
  /** Priced from the shop's settings rather than a built-in constant. */
  delivery: DeliveryMethod;
  /** Set when this browser already confirmed the delivery number. */
  phoneVerified: boolean;
  onContinue: () => void;
  pending?: boolean;
  error?: string;
}

const FOOTER_BADGES = [
  { icon: Lock, label: "Secure payment" },
  { icon: Zap, label: "Fast delivery" },
  { icon: RotateCcw, label: "Easy returns" },
];

export default function StepDelivery({
  details,
  onChange,
  lines,
  subtotal,
  delivery,
  phoneVerified,
  onContinue,
  pending = false,
  error,
}: StepDeliveryProps) {
  // Open the contact editor when either required field is still missing,
  // so nothing needed to continue is hidden behind the collapsed row.
  const [editingContact, setEditingContact] = useState(!details.fullName || !details.phone);
  const fee = delivery.fee;
  const normalized = normalizeBdPhone(details.phone);
  const displayPhone = normalized ? formatBdPhone(normalized) : details.phone;

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="mb-3 flex items-start gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand">
            <MapPin className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-bold leading-tight text-ink-strong">Delivery address</h2>
            <p className="text-[10px] text-ink-slate">Where should we deliver your order?</p>
          </div>
          {phoneVerified && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-tint px-2 py-1 text-[9px] font-bold text-brand-dark">
              <BadgeCheck className="h-3 w-3" />
              Verified
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setEditingContact((value) => !value)}
          className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint">
            <User className="h-4 w-4 text-brand" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink-strong">
              {details.fullName || "Add your name"}
            </span>
            <span className="block truncate text-[12px] text-ink-slate">
              {displayPhone || "Add your mobile number"}
            </span>
          </span>
          {phoneVerified && (
            <span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 text-[9px] font-bold text-brand-dark">
              Verified
            </span>
          )}
          {editingContact ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-ink-slate" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-slate" />
          )}
        </button>

        {editingContact && (
          <div className="mt-2 grid gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-ink-slate">Full name</span>
              <input
                value={details.fullName}
                onChange={(event) => onChange({ fullName: event.target.value })}
                placeholder="Your full name"
                autoComplete="name"
                className="w-full rounded-xl border border-line px-3 py-2.5 text-sm text-ink-strong outline-none placeholder:text-ink-faint focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-ink-slate">Mobile number</span>
              <input
                value={details.phone}
                onChange={(event) => onChange({ phone: event.target.value })}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                className="w-full rounded-xl border border-line px-3 py-2.5 text-sm text-ink-strong outline-none placeholder:text-ink-faint focus:border-brand"
              />
            </label>
          </div>
        )}

        {/* Three fields, not two: a Bangladeshi address is division ->
            district -> upazila, and collapsing the middle level is what left
            most of the country with no address it could pick. Division and
            district share a row; the thana list is long, so it takes a row of
            its own. The picker owns their layout and their list sheet. */}
        <div className="mt-2">
          <LocationPicker
            value={{
              division: details.division,
              district: details.district,
              area: details.area,
            }}
            onChange={onChange}
          />
        </div>

        {/* Address is typed, not picked, so it gets the same card without a
            chevron: a chevron here would promise a picker that does not exist. */}
        <label className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-2 focus-within:border-brand">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
            <House className="h-3.5 w-3.5 text-brand" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9.5px] font-semibold text-ink-slate">
              Address details
            </span>
            <input
              value={details.addressDetails}
              onChange={(event) => onChange({ addressDetails: event.target.value })}
              placeholder="House 12, Road 5"
              autoComplete="street-address"
              className="w-full border-0 p-0 text-[13px] font-semibold text-ink-strong outline-none placeholder:font-normal placeholder:text-ink-faint"
            />
          </span>
        </label>

        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-brand-tint/60 px-2.5 py-2 text-[10px] text-brand-dark">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-brand" />
          <span>
            <span className="font-bold">Your information is safe &amp; secure</span>
            <br />
            We never share your data with anyone.
          </span>
        </p>
      </section>

      {/* One delivery option, so this states the charge rather than asking the
          shopper to choose between tiers that no longer exist. */}
      <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand">
            <Truck className="h-[22px] w-[22px] text-white" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[16px] font-bold leading-tight text-ink-strong">
                {delivery.name}
              </h2>
              <span className="shrink-0 rounded-md bg-brand-tint px-1.5 py-0.5 text-[9px] font-semibold text-brand-dark">
                {delivery.eta}
              </span>
            </div>
            <p className="truncate text-[12px] text-ink-slate">{delivery.tagline}</p>
          </div>
          <span className="shrink-0 text-sm font-bold text-brand-darkest">
            {delivery.fee === 0 ? "Free" : formatPrice(delivery.fee)}
          </span>
        </div>
      </section>

      <OrderSummary
        lines={lines}
        subtotal={subtotal}
        deliveryFee={fee}
        total={subtotal + fee}
        subtitle="Review your items and final amount"
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-red/10 px-4 py-3 text-xs font-medium text-accent-red">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-full btn-brand py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/25 disabled:opacity-60"
      >
        <Lock className="h-4 w-4" />
        Continue to Payment
        <ArrowRight className="h-4 w-4" />
      </button>

      <div className="flex items-center justify-center gap-4 text-[10px] font-medium text-ink-slate">
        {FOOTER_BADGES.map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1">
            <Icon className="h-3 w-3 text-brand" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
