"use client";

import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  House,
  Lock,
  MapPin,
  PackageCheck,
  RotateCcw,
  Truck,
  Zap,
} from "lucide-react";
import LocationPicker from "@/components/address/LocationPicker";
import type { DeliveryMethod } from "@/lib/checkout";
import type { DeliveryDetails } from "@/lib/checkout";
import type { DeliveryMethodId } from "@/types";
import { formatPrice } from "@/lib/format";
import OrderSummary, { type SummaryLine } from "./OrderSummary";

interface StepDeliveryProps {
  details: DeliveryDetails;
  onChange: (patch: Partial<DeliveryDetails>) => void;
  lines: SummaryLine[];
  subtotal: number;
  /** Both options, priced and locked for this order's subtotal. */
  deliveryOptions: DeliveryMethod[];
  /** The one in force -- the choice, or home delivery when it is not allowed. */
  selectedDelivery: DeliveryMethodId;
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
  deliveryOptions,
  selectedDelivery,
  phoneVerified,
  onContinue,
  pending = false,
  error,
}: StepDeliveryProps) {
  const fee = deliveryOptions.find((option) => option.id === selectedDelivery)?.fee ?? 0;

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

        {/* Name and number are always open. The collapsed summary row they
            used to hide behind only restated what the fields already show. */}
        <div className="grid gap-2">
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

        {/* A locked option stays in place, dimmed, rather than disappearing:
            the shopper can see the free delivery they have not reached yet. */}
        <div className="flex flex-col gap-2">
          {deliveryOptions.map((option) => {
            const selected = option.id === selectedDelivery;
            const Icon = option.id === "free" ? PackageCheck : Truck;
            return (
              <label
                key={option.id}
                aria-disabled={option.locked}
                className={`flex items-center gap-2.5 rounded-xl border p-3 transition-colors ${
                  option.locked
                    ? "cursor-not-allowed border-line bg-brand-mist/40 opacity-60"
                    : selected
                      ? "cursor-pointer border-brand bg-brand-tint/50"
                      : "cursor-pointer border-line bg-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    selected && !option.locked
                      ? "bg-brand text-white"
                      : "bg-brand-mist text-ink-slate"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {/* The badge sits under the tagline rather than beside the
                    name: "Free Home Delivery" does not fit on one line with a
                    chip next to it at phone width. */}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold leading-tight text-ink-strong">
                    {option.name}
                  </span>
                  <span className="block truncate text-[10px] text-ink-slate">{option.tagline}</span>
                  <span className="mt-1 inline-flex items-center gap-0.5 rounded-md bg-brand-tint px-1.5 py-0.5 text-[9px] font-semibold text-brand-dark">
                    {option.locked && <Lock className="h-2.5 w-2.5" />}
                    {option.badge}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold text-brand-darkest">
                  {option.fee === 0 ? "Free" : formatPrice(option.fee)}
                </span>
                <input
                  type="radio"
                  name="deliveryMethod"
                  checked={selected}
                  disabled={option.locked}
                  onChange={() => onChange({ deliveryMethod: option.id })}
                  className="h-4 w-4 shrink-0 accent-brand disabled:cursor-not-allowed"
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
