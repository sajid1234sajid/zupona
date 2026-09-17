"use client";

import { useActionState } from "react";
import { KeyRound, Loader2, MessageSquare, Save, Send } from "lucide-react";
import { Card, CardHeader, Field, FormMessage, buttonStyles, fieldStyles } from "./ui";
import {
  changeAdminPasswordAction,
  saveSettingsAction,
  sendTestSmsAction,
  type SettingsFormState,
} from "@/app/admin/(panel)/settings/actions";
import type { ShopSettings } from "@/lib/shopSettings";
import type { SmsBalance, SmsGatewayStatus } from "@/lib/sms";

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
/** Below this, the gateway is close enough to empty to say so out loud. A
 * Bangladeshi bulk SMS costs a fraction of a Taka, so this is a couple of
 * hundred codes -- days of ordinary trading, not months. */
const LOW_BALANCE_TAKA = 50;

export function StoreSettingsForm({
  settings,
  smsStatus,
  smsBalance,
}: {
  settings: ShopSettings;
  smsStatus: SmsGatewayStatus;
  /** What is left at the gateway, when the provider will say. */
  smsBalance: SmsBalance | null;
}) {
  const balanceLow = smsBalance !== null && smsBalance.amount < LOW_BALANCE_TAKA;
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
          <Field label="Delivery charge" hint="The shop's only delivery fee">
            <input
              name="delivery_fee"
              type="number"
              min={0}
              defaultValue={settings.deliveryFee}
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
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Verification & SMS"
          subtitle="The one-time code checkout sends to confirm a delivery number"
        />

        <div
          className={`mb-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${
            smsStatus.configured && !balanceLow
              ? "border-brand/40 bg-brand-tint/40"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <MessageSquare
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              smsStatus.configured && !balanceLow ? "text-brand" : "text-amber-600"
            }`}
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-neutral-800">
              {smsStatus.configured
                ? `Connected to ${smsStatus.providerLabel}`
                : `${smsStatus.providerLabel} is not connected`}
            </p>
            <p className="text-[11px] text-neutral-500">
              {smsStatus.configured
                ? smsStatus.senderId
                  ? `Codes go out under the sender mask ${smsStatus.senderId}.`
                  : "Codes go out on the gateway's default route — no sender mask set."
                : smsStatus.problem}
            </p>

            {smsBalance !== null && (
              <p
                className={`mt-1 text-[11px] ${
                  balanceLow ? "font-semibold text-amber-700" : "text-neutral-500"
                }`}
              >
                {/* The gateway bills in Taka whatever currency the storefront
                    displays, so this figure is not the shop's symbol. */}
                Gateway balance ৳{smsBalance.amount}
                {smsBalance.validUntil ? ` · valid to ${smsBalance.validUntil.slice(0, 10)}` : ""}
                {balanceLow && " — top this up. When it runs out no code is sent, and every checkout stops at the verification step."}
              </p>
            )}
          </div>
        </div>

        <Field
          label="Sender mask"
          hint="The name shown as the sender. Leave blank for the gateway's default route"
        >
          <input
            name="sms_sender_id"
            maxLength={20}
            defaultValue={settings.smsSenderId ?? ""}
            placeholder="Zupona"
            className={fieldStyles}
          />
        </Field>

        <div className="mt-4">
          <Toggle
            name="otp_demo_mode"
            label="Show verification codes on screen"
            detail={
              smsStatus.configured
                ? "Ignored while a gateway is connected — codes go to the handset. It only applies to a shop with no gateway, where it prints the code in the checkout so the flow can still be tested"
                : "Prints the code in the checkout instead of sending it, so the flow can be tested without a gateway. Anyone can then read the code for any number — connect a gateway before taking real orders"
            }
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

/** Proves the gateway end to end without placing an order.
 *
 * Its own form rather than a field in the settings form: forms cannot nest,
 * and sending a message is not a setting -- pressing Save should never post a
 * text to whatever number was left in a box. */
export function SmsTestForm({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    sendTestSmsAction,
    {}
  );

  return (
    <Card>
      <CardHeader title="Send a test message" subtitle="One real SMS, to check the gateway" />
      <form action={formAction} className="space-y-3">
        <FormMessage error={state.error} success={state.success} />

        <Field label="Mobile number">
          <input
            name="test_phone"
            inputMode="numeric"
            placeholder="01712345678"
            className={fieldStyles}
          />
        </Field>

        <button
          type="submit"
          disabled={pending || !configured}
          className={`${buttonStyles.primary} w-full justify-center disabled:opacity-40`}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {pending ? "Sending…" : "Send test"}
        </button>

        {!configured && (
          <p className="text-[11px] text-neutral-400">
            Connect a gateway first — see Verification &amp; SMS.
          </p>
        )}
      </form>
    </Card>
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
