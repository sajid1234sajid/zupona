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
import { divisionNames, areasForDivision } from "@/data/locations";
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
  const areas = areasForDivision(details.division);
  const fee = deliveryMethods.find((method) => method.id === details.deliveryMethod)?.fee ?? 0;
  const normalized = normalizeBdPhone(details.phone);
  const displayPhone = normalized ? formatBdPhone(normalized) : details.phone;

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <section className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand">
            <MapPin className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-neutral-800">Delivery address</h2>
            <p className="text-[10px] text-neutral-400">Where should we deliver your order?</p>
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
          className="flex w-full items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint">
            <User className="h-4 w-4 text-brand" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-neutral-800">
              {details.fullName || "Add your name"}
            </span>
            <span className="block truncate text-[11px] text-neutral-400">
              {displayPhone || "Add your mobile number"}
            </span>
          </span>
          {phoneVerified && (
            <span className="shrink-0 rounded-full bg-brand-tint px-2 py-0.5 text-[9px] font-bold text-brand-dark">
              Verified
            </span>
          )}
          {editingContact ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-neutral-400" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
          )}
        </button>

        {editingContact && (
          <div className="mt-2 grid gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-neutral-500">Full name</span>
              <input
                value={details.fullName}
                onChange={(event) => onChange({ fullName: event.target.value })}
                placeholder="Your full name"
                autoComplete="name"
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-neutral-500">Mobile number</span>
              <input
                value={details.phone}
                onChange={(event) => onChange({ phone: event.target.value })}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-brand"
              />
            </label>
          </div>
        )}

        {/* The reference draws each of these as one card: a pale icon tile, the
            label above the chosen value, and a chevron. The native <select> is
            kept and laid over the card at zero opacity, so the phone's own
            picker still opens and the control stays focusable and labelled --
            only its painting is replaced. */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="relative block rounded-xl border border-neutral-200 bg-white px-2.5 py-2 focus-within:border-brand">
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                <MapPin className="h-3.5 w-3.5 text-brand" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9.5px] font-semibold text-neutral-400">
                  Division / City
                </span>
                <span
                  className={`block truncate text-[13px] font-semibold ${
                    details.division ? "text-neutral-800" : "text-neutral-300"
                  }`}
                >
                  {details.division || "Select"}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
            </span>
            <select
              value={details.division}
              onChange={(event) => onChange({ division: event.target.value, area: "" })}
              aria-label="Division / City"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              <option value="">Select</option>
              {divisionNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="relative block rounded-xl border border-neutral-200 bg-white px-2.5 py-2 focus-within:border-brand">
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                <MapPin className="h-3.5 w-3.5 text-brand" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9.5px] font-semibold text-neutral-400">
                  Area / Thana
                </span>
                <span
                  className={`block truncate text-[13px] font-semibold ${
                    details.area ? "text-neutral-800" : "text-neutral-300"
                  }`}
                >
                  {details.area || (areas.length === 0 ? "Pick a division" : "Select")}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
            </span>
            <select
              value={details.area}
              onChange={(event) => onChange({ area: event.target.value })}
              disabled={areas.length === 0}
              aria-label="Area / Thana"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            >
              <option value="">{areas.length === 0 ? "Pick a division" : "Select"}</option>
              {areas.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Address is typed, not picked, so it gets the same card without a
            chevron: a chevron here would promise a picker that does not exist. */}
        <label className="mt-2 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-2.5 py-2 focus-within:border-brand">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
            <House className="h-3.5 w-3.5 text-brand" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9.5px] font-semibold text-neutral-400">
              Address details
            </span>
            <input
              value={details.addressDetails}
              onChange={(event) => onChange({ addressDetails: event.target.value })}
              placeholder="House 12, Road 5"
              autoComplete="street-address"
              className="w-full border-0 p-0 text-[13px] font-semibold text-neutral-800 outline-none placeholder:font-normal placeholder:text-neutral-300"
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

      <section className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
            <Truck className="h-4 w-4 text-brand" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-neutral-800">Delivery method</h2>
            <p className="text-[10px] text-neutral-400">
              Choose how you would like to receive your order
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
                  selected ? "border-brand bg-brand-tint/50" : "border-neutral-200 bg-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    selected ? "bg-brand text-white" : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  <Truck className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-bold text-neutral-800">{method.name}</span>
                    <span className="shrink-0 rounded-md bg-brand-tint px-1.5 py-0.5 text-[9px] font-semibold text-brand-dark">
                      {method.eta}
                    </span>
                  </span>
                  <span className="block truncate text-[10px] text-neutral-400">{method.tagline}</span>
                </span>
                <span className="shrink-0 text-sm font-bold text-brand-darkest">
                  {formatPrice(method.fee)}
                </span>
                <input
                  type="radio"
                  name="deliveryMethod"
                  checked={selected}
                  onChange={() => onChange({ deliveryMethod: method.id })}
                  className="h-4 w-4 shrink-0 accent-[#16a34a]"
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
        subtitle="Review your items and total"
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
        className="flex items-center justify-center gap-2 rounded-xl bg-brand-dark py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/25 disabled:opacity-60"
      >
        <Lock className="h-4 w-4" />
        Continue to Payment
        <ArrowRight className="h-4 w-4" />
      </button>

      <div className="flex items-center justify-center gap-4 text-[10px] font-medium text-neutral-400">
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
