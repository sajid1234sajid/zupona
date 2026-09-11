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
import { divisionNames, districtsForDivision, upazilasForDistrict } from "@/data/locations";
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
  deliveryMethods: DeliveryMethod[];
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
  deliveryMethods,
  phoneVerified,
  onContinue,
  pending = false,
  error,
}: StepDeliveryProps) {
  // Open the contact editor when either required field is still missing,
  // so nothing needed to continue is hidden behind the collapsed row.
  const [editingContact, setEditingContact] = useState(!details.fullName || !details.phone);
  const districts = districtsForDivision(details.division);
  const areas = upazilasForDistrict(details.division, details.district);
  const fee = deliveryMethods.find((method) => method.id === details.deliveryMethod)?.fee ?? 0;
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

        {/* The reference draws each of these as one card: a pale icon tile, the
            label above the chosen value, and a chevron. The native <select> is
            kept and laid over the card at zero opacity, so the phone's own
            picker still opens and the control stays focusable and labelled --
            only its painting is replaced.

            Three of them, not two: a Bangladeshi address is division ->
            district -> upazila, and collapsing the middle level is what left
            most of the country with no address it could pick. Division and
            district share a row as before; the thana list is long, so it takes
            a row of its own. */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <GeoField
            label="Division"
            value={details.division}
            options={divisionNames}
            placeholder="Select"
            onChange={(value) => onChange({ division: value, district: "", area: "" })}
          />
          <GeoField
            label="District"
            value={details.district}
            options={districts}
            placeholder={districts.length === 0 ? "Pick a division" : "Select"}
            onChange={(value) => onChange({ district: value, area: "" })}
          />
        </div>

        <div className="mt-2">
          <GeoField
            label="Area / Thana"
            value={details.area}
            options={areas}
            placeholder={areas.length === 0 ? "Pick a district" : "Select"}
            onChange={(value) => onChange({ area: value })}
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

      <section className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand">
            <Truck className="h-[22px] w-[22px] text-white" strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-[16px] font-bold leading-tight text-ink-strong">Delivery method</h2>
            <p className="text-[12px] text-ink-slate">
              Choose how you&apos;d like to receive your order
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {deliveryMethods.map((method) => {
            const selected = details.deliveryMethod === method.id;
            return (
              <label
                key={method.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 transition-colors ${
                  selected ? "border-brand bg-brand-tint/50" : "border-line bg-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    selected ? "bg-brand text-white" : "bg-brand-mist text-ink-slate"
                  }`}
                >
                  <Truck className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-bold text-ink-strong">{method.name}</span>
                    <span className="shrink-0 rounded-md bg-brand-tint px-1.5 py-0.5 text-[9px] font-semibold text-brand-dark">
                      {method.eta}
                    </span>
                  </span>
                  <span className="block truncate text-[10px] text-ink-slate">{method.tagline}</span>
                </span>
                <span className="shrink-0 text-sm font-bold text-brand-darkest">
                  {formatPrice(method.fee)}
                </span>
                <input
                  type="radio"
                  name="deliveryMethod"
                  checked={selected}
                  onChange={() => onChange({ deliveryMethod: method.id })}
                  className="h-4 w-4 shrink-0 accent-brand"
                />
              </label>
            );
          })}
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

/** One address picker: the reference's card, with a real <select> laid over it
 * at zero opacity so the phone's native list still opens and the control keeps
 * its label, focus ring and keyboard behaviour. Disabled until the level above
 * it has been chosen, because the options depend on it. */
function GeoField({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const empty = options.length === 0;

  return (
    <label className="relative block rounded-xl border border-line bg-white px-2.5 py-2 focus-within:border-brand">
      <span className="flex items-center gap-2">
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
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={empty}
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
