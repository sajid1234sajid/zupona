"use client";

import { useActionState } from "react";
import { KeyRound, Loader2, Save } from "lucide-react";
import { Card, CardHeader, Field, FormMessage, buttonStyles, fieldStyles } from "./ui";
import {
  changeAdminPasswordAction,
  saveSettingsAction,
  type SettingsFormState,
} from "@/app/admin/(panel)/settings/actions";
import type { ShopSettings } from "@/lib/shopSettings";

/** A switch whose "off" state still reaches the server.
 *
 * An unchecked checkbox posts nothing at all, which is indistinguishable from
 * "this form doesn't have that field". The hidden marker beside it says the
 * field was on the form, so the action can tell "turned off" from "not
 * submitted". */
function Toggle({
  name,
  label,
  detail,
  checked,
}: {
  name: string;
  label: string;
  detail: string;
  checked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 px-3.5 py-3 transition has-[:checked]:border-brand has-[:checked]:bg-brand-tint/40">
      <input type="hidden" name={`__present_${name}`} value="1" />
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#16a34a]"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-neutral-800">{label}</span>
        <span className="block text-[11px] text-neutral-400">{detail}</span>
      </span>
    </label>
  );
}

/** Every field is prefilled from the settings actually in force, defaults
 * included. Hardcoding fallbacks in the form instead would mean saving the
 * page could quietly change a value nobody touched -- the free-shipping
 * threshold showing 0 while the shop was really using 999, for instance. */
export function StoreSettingsForm({ settings }: { settings: ShopSettings }) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    saveSettingsAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      <Card>
        <CardHeader title="Store Details" subtitle="Used across the storefront and in emails" />
        <div className="space-y-4">
          <FormMessage error={state.error} success={state.success} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store name">
              <input name="store_name" defaultValue={settings.storeName} className={fieldStyles} />
            </Field>
            <Field label="Tagline">
              <input
                name="store_tagline"
                defaultValue={settings.storeTagline}
                className={fieldStyles}
              />
            </Field>
            <Field label="Support email">
              <input
                name="support_email"
                type="email"
                defaultValue={settings.supportEmail ?? ""}
                placeholder="help@zupona.com"
                className={fieldStyles}
              />
            </Field>
            <Field label="Support phone">
              <input
                name="support_phone"
                defaultValue={settings.supportPhone ?? ""}
                placeholder="+8801XXXXXXXXX"
                className={fieldStyles}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Shipping & Pricing" subtitle="Whole Taka — no decimals anywhere" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Standard delivery">
            <input
              name="standard_shipping_fee"
              type="number"
              min={0}
              defaultValue={settings.standardShippingFee}
              className={fieldStyles}
            />
          </Field>
          <Field label="Express delivery">
            <input
              name="express_shipping_fee"
              type="number"
              min={0}
              defaultValue={settings.expressShippingFee}
              className={fieldStyles}
            />
          </Field>
          <Field label="Free shipping over" hint="0 disables it">
            <input
              name="free_shipping_threshold"
              type="number"
              min={0}
              defaultValue={settings.freeShippingThreshold}
              className={fieldStyles}
            />
          </Field>
          <Field label="Currency symbol">
            <input
              name="currency_symbol"
              maxLength={4}
              defaultValue={settings.currencySymbol}
              className={fieldStyles}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Returns & Exchange"
          subtitle="Shown on every product page — 0 hides the line"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Return window (days)">
            <input
              name="return_days"
              type="number"
              min={0}
              defaultValue={settings.returnDays}
              className={fieldStyles}
            />
          </Field>
          <Field label="Exchange window (days)">
            <input
              name="exchange_days"
              type="number"
              min={0}
              defaultValue={settings.exchangeDays}
              className={fieldStyles}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Marketplace & Inventory" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default commission rate (%)" hint="Applied to new distributor stores">
            <input
              name="default_commission_rate"
              type="number"
              min={0}
              max={100}
              defaultValue={10}
              className={fieldStyles}
            />
          </Field>
          <Field label="Low stock threshold" hint="Default alert level for new products">
            <input
              name="low_stock_threshold"
              type="number"
              min={0}
              defaultValue={settings.lowStockThreshold}
              className={fieldStyles}
            />
          </Field>
        </div>

        <div className="mt-4 space-y-2.5">
          <Toggle
            name="reviews_need_approval"
            label="Hold new reviews for moderation"
            detail="Reviews land as Pending instead of going live straight away"
            checked={settings.reviewsNeedApproval}
          />
          <Toggle
            name="guest_checkout_enabled"
            label="Allow guest checkout"
            detail="Shoppers can order without creating an account first"
            checked={settings.guestCheckoutEnabled}
          />
          <Toggle
            name="maintenance_mode"
            label="Maintenance mode"
            detail="Shows a holding page to shoppers — the admin panel stays open"
            checked={settings.maintenanceMode}
          />
          <Toggle
            name="otp_demo_mode"
            label="Show verification codes on screen"
            detail="No SMS gateway is connected yet. With this on, the checkout prints the code so orders can be completed and tested — turn it off the moment a real provider is configured"
            checked={settings.otpDemoMode}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pending ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    changeAdminPasswordAction,
    {}
  );

  return (
    <Card>
      <CardHeader title="Change Password" subtitle="Signs out your other devices" />
      <form action={formAction} className="space-y-4">
        <FormMessage error={state.error} success={state.success} />

        <Field label="Current password">
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            className={fieldStyles}
          />
        </Field>
        <Field label="New password" hint="At least 10 characters">
          <input
            name="newPassword"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className={fieldStyles}
          />
        </Field>
        <Field label="Confirm new password">
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className={fieldStyles}
          />
        </Field>

        <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full`}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {pending ? "Updating…" : "Change Password"}
        </button>
      </form>
    </Card>
  );
}
