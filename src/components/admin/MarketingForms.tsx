"use client";

import { useActionState } from "react";
import { Loader2, Megaphone, Send, Zap } from "lucide-react";
import ImageUploader from "./ImageUploader";
import { Card, CardHeader, Field, FormMessage, buttonStyles, fieldStyles, textareaStyles } from "./ui";
import {
  broadcastAction,
  createBannerAction,
  createFlashSaleAction,
  type MarketingFormState,
} from "@/app/admin/(panel)/marketing/actions";

/** Homepage banner composer. */
export function BannerForm() {
  const [state, formAction, pending] = useActionState<MarketingFormState, FormData>(
    createBannerAction,
    {}
  );

  return (
    <Card>
      <CardHeader title="New Banner" subtitle="Merchandising slots on the storefront" />
      <form action={formAction} className="space-y-4">
        <FormMessage error={state.error} success={state.success} />

        <Field label="Headline" required>
          <input
            name="title"
            required
            maxLength={80}
            placeholder="Eid Sale — up to 50% off"
            className={fieldStyles}
          />
        </Field>

        <Field label="Subtitle">
          <input
            name="subtitle"
            maxLength={120}
            placeholder="Ends Sunday midnight"
            className={fieldStyles}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Placement" required>
            <select name="placement" defaultValue="hero" className={fieldStyles}>
              <option value="hero">Hero — top of homepage</option>
              <option value="promo">Promo strip — under the departments</option>
            </select>
          </Field>
          <Field label="Sort order" hint="Lower shows first">
            <input name="sortOrder" type="number" defaultValue={0} className={fieldStyles} />
          </Field>
        </div>

        <Field label="Links to" hint="A path on your site, e.g. /offers">
          <input name="linkUrl" maxLength={200} placeholder="/offers" className={fieldStyles} />
        </Field>

        <ImageUploader
          name="image"
          folder="products"
          max={1}
          label="Banner Image"
          hint="Wide images work best — around 1200×400"
        />

        <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full`}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
          {pending ? "Publishing…" : "Publish Banner"}
        </button>
      </form>
    </Card>
  );
}

/** In-app announcement to a customer segment. */
export function BroadcastForm() {
  const [state, formAction, pending] = useActionState<MarketingFormState, FormData>(
    broadcastAction,
    {}
  );

  return (
    <Card>
      <CardHeader
        title="Send an Announcement"
        subtitle="Lands in the customer's notifications tab"
      />
      <form action={formAction} className="space-y-4">
        <FormMessage error={state.error} success={state.success} />

        <Field label="Audience" required>
          <select name="segment" defaultValue="all" className={fieldStyles}>
            <option value="all">Everyone with an active account</option>
            <option value="buyers">Customers who have ordered</option>
            <option value="inactive">Lapsed — no order in 90 days</option>
          </select>
        </Field>

        <Field label="Title" required>
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Your favourites are on sale"
            className={fieldStyles}
          />
        </Field>

        <Field label="Message" required>
          <textarea
            name="body"
            required
            rows={4}
            maxLength={500}
            placeholder="Use code SUMMER25 for 25% off until Sunday."
            className={textareaStyles}
          />
        </Field>

        <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full`}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {pending ? "Sending…" : "Send Announcement"}
        </button>
        <p className="text-[11px] text-neutral-400">
          This cannot be unsent — it appears in customers&apos; notifications immediately.
        </p>
      </form>
    </Card>
  );
}

/** Schedules a time-boxed sale; products are attached to it afterwards. */
export function FlashSaleForm() {
  const [state, formAction, pending] = useActionState<MarketingFormState, FormData>(
    createFlashSaleAction,
    {}
  );

  return (
    <Card>
      <CardHeader title="Schedule a Flash Sale" subtitle="A time-boxed price drop" />
      <form action={formAction} className="space-y-4">
        <FormMessage error={state.error} success={state.success} />

        <Field label="Sale name" required>
          <input
            name="name"
            required
            maxLength={80}
            placeholder="Friday Lightning Deals"
            className={fieldStyles}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" required>
            <input name="startsAt" type="datetime-local" required className={fieldStyles} />
          </Field>
          <Field label="Ends" required>
            <input name="endsAt" type="datetime-local" required className={fieldStyles} />
          </Field>
        </div>

        <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full`}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {pending ? "Scheduling…" : "Schedule Sale"}
        </button>
      </form>
    </Card>
  );
}
